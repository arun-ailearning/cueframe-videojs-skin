import { useState } from 'react';
import type { ReviewCue, ReviewCueCategory } from '../types';
import {
  exportCuesToCsv,
  exportCuesToEdl,
  exportCuesToMarkdown,
  formatSmpteTimecode,
} from '../utils/timecode';

interface ReviewSlateDrawerProps {
  cues: ReviewCue[];
  currentTime: number;
  fps?: number;
  productionTitle?: string;
  defaultReviewer: string;
  isComposerOpen: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCloseDrawer: () => void;
  onAddCue: (input: { timestamp: number; category: ReviewCueCategory; note: string; author: string }) => void;
  onUpdateCue: (id: string, patch: Partial<Pick<ReviewCue, 'note' | 'category' | 'resolved'>>) => void;
  onDeleteCue: (id: string) => void;
  onSeekToCue: (timestamp: number) => void;
}

const CATEGORIES: ReviewCueCategory[] = ['Picture', 'Edit', 'Sound', 'Fix'];

/**
 * MODE 02 — REVIEW Slate Drawer & Quick-Note Composer.
 *
 * CRITICAL CINEMATIC REVIEW UPGRADE:
 * 1. Zero-blur crisp background (`backdrop-filter: none`) so the video playback
 *    is never obscured by a muddy frosted layer.
 * 2. Ghost View Mode toggle (Solid 96% vs Ghost 35% translucent) allowing directors
 *    to watch the video right through the notes list while screening.
 * 3. Compact Minimize toggle (`_` / `+`) allowing the drawer to collapse into an unobtrusive
 *    peek strip so the entire video viewport stays clear on mobile and desktop.
 */
export function ReviewSlateDrawer({
  cues,
  currentTime,
  fps,
  productionTitle,
  defaultReviewer,
  isComposerOpen,
  onOpenComposer,
  onCloseComposer,
  onCloseDrawer,
  onAddCue,
  onUpdateCue,
  onDeleteCue,
  onSeekToCue,
}: ReviewSlateDrawerProps) {
  const [filterCategory, setFilterCategory] = useState<ReviewCueCategory | 'ALL'>('ALL');
  const [draftCategory, setDraftCategory] = useState<ReviewCueCategory>('Edit');
  const [draftNote, setDraftNote] = useState('');
  const [draftAuthor, setDraftAuthor] = useState(defaultReviewer);
  const [editingCueId, setEditingCueId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Ghost Mode (Semi-transparent see-through view) & Minimized Peek State
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const filteredCues =
    filterCategory === 'ALL' ? cues : cues.filter((c) => c.category === filterCategory);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftNote.trim();
    if (!trimmed) return;
    onAddCue({
      timestamp: currentTime,
      category: draftCategory,
      note: trimmed,
      author: draftAuthor.trim() || defaultReviewer,
    });
    setDraftNote('');
    onCloseComposer();
  };

  const triggerDownloadOrCopy = async (content: string, filename: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      }
    } catch {
      /* Clipboard optional */
    }

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* JSDOM or restricted download fallback */
    }

    setExportStatus(`${label} exported (${cues.length} cues)`);
    window.setTimeout(() => setExportStatus(null), 2800);
  };

  return (
    <aside
      className="cueframe-review-drawer"
      data-ghost={isGhostMode ? 'true' : 'false'}
      data-minimized={isMinimized ? 'true' : 'false'}
      aria-label="Director Review Notes Drawer"
      data-testid="review-slate-drawer"
    >
      {/* Drawer Header with Title, Ghost View, Minimize & Close Controls */}
      <div
        className="cueframe-drawer-header"
        style={{
          padding: '7px 10px',
          borderBottom: isMinimized ? 'none' : '1px solid var(--cueframe-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span
            className="cueframe-tabular"
            style={{ fontSize: '11px', fontWeight: 700, color: '#e5a93c', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
          >
            REVIEW SLATE ({cues.length})
          </span>
          {isMinimized && cues.length > 0 && (
            <span
              className="cueframe-tabular"
              style={{
                fontSize: '10px',
                color: 'var(--cueframe-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Latest: {cues[cues.length - 1].category} @ {formatSmpteTimecode(cues[cues.length - 1].timestamp, fps)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          {/* Ghost Mode Toggle (Removes visual opacity so video can be watched without closing notes) */}
          {!isMinimized && (
            <button
              type="button"
              className="cueframe-btn"
              data-active={isGhostMode}
              aria-pressed={isGhostMode}
              data-testid="toggle-ghost-mode-btn"
              onClick={() => setIsGhostMode((g) => !g)}
              title={isGhostMode ? 'Switch to Solid Background' : 'Ghost Mode: See video through notes'}
              style={{ height: '22px', minWidth: 'auto', padding: '0 5px', fontSize: '10px' }}
            >
              {isGhostMode ? '👁 Solid' : '👁 Ghost'}
            </button>
          )}

          {/* Quick-Add / Cancel Composer Button */}
          <button
            type="button"
            className={`cueframe-btn ${isComposerOpen ? '' : 'cueframe-btn-primary'}`}
            onClick={() => {
              if (isMinimized) setIsMinimized(false);
              if (isComposerOpen) onCloseComposer();
              else onOpenComposer();
            }}
            data-testid="toggle-cue-composer-btn"
            style={{
              height: '22px',
              minWidth: 'auto',
              padding: '0 8px',
              fontSize: '10px',
              fontWeight: 600,
              background: isComposerOpen ? '#262633' : undefined,
              border: isComposerOpen ? '1px solid #4a4a5c' : undefined,
              color: isComposerOpen ? '#f4f4f6' : undefined,
            }}
          >
            {isComposerOpen ? '✕ Cancel' : '+ Cue'}
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            className="cueframe-btn"
            onClick={() => setIsMinimized((m) => !m)}
            aria-label={isMinimized ? 'Expand review slate drawer' : 'Minimize review slate drawer'}
            data-testid="minimize-review-drawer-btn"
            title={isMinimized ? 'Expand drawer' : 'Minimize drawer to see full video'}
            style={{ height: '22px', minWidth: '22px', padding: 0, fontSize: '11px' }}
          >
            {isMinimized ? '▲' : '▼'}
          </button>

          {/* Full Dismissal Button */}
          <button
            type="button"
            className="cueframe-btn"
            onClick={onCloseDrawer}
            aria-label="Close review slate drawer"
            data-testid="close-review-drawer-btn"
            title="Close drawer"
            style={{ height: '22px', minWidth: '22px', padding: 0, fontSize: '13px' }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body content only visible when not minimized */}
      {!isMinimized && (
        <>
          {/* Quick-Note Composer Form */}
          {isComposerOpen && (
            <form
              onSubmit={handleCreateSubmit}
              data-testid="cue-composer-form"
              style={{
                padding: '8px 10px',
                background: '#0d0d12',
                borderBottom: '1px solid var(--cueframe-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--cueframe-text-secondary)' }}>Cue Timecode:</span>
                  <strong className="cueframe-tabular" style={{ color: '#e5a93c' }}>
                    {formatSmpteTimecode(currentTime, fps)}
                  </strong>
                </div>
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="composer-header-cancel-btn"
                  onClick={onCloseComposer}
                  aria-label="Cancel cue creation (Esc)"
                  title="Cancel cue creation (Esc)"
                  style={{ height: '20px', minWidth: '20px', padding: 0, fontSize: '13px', color: '#a1a1aa' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', gap: '4px' }} role="radiogroup" aria-label="Cue department category">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="cueframe-btn"
                    data-active={draftCategory === cat}
                    aria-pressed={draftCategory === cat}
                    onClick={() => setDraftCategory(cat)}
                    style={{ flex: 1, height: '24px', minWidth: 'auto', padding: '0 4px', fontSize: '10px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="cueframe-input"
                aria-label="Reviewer name"
                placeholder="Reviewer (e.g. Director)"
                value={draftAuthor}
                onChange={(e) => setDraftAuthor(e.target.value)}
                style={{
                  width: '100%',
                  padding: '4px 7px',
                  fontSize: '11px',
                  background: '#09090b',
                  color: 'var(--cueframe-text-primary)',
                  border: '1px solid var(--cueframe-border-strong)',
                  borderRadius: '4px',
                }}
              />

              <textarea
                className="cueframe-input"
                aria-label="Review note"
                data-testid="cue-note-input"
                placeholder="Add frame-specific review feedback..."
                rows={2}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '5px 7px',
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  background: '#09090b',
                  color: 'var(--cueframe-text-primary)',
                  border: '1px solid var(--cueframe-border-strong)',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="cancel-cue-btn"
                  onClick={onCloseComposer}
                  aria-label="Cancel cue creation"
                  style={{
                    height: '26px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: '#202028',
                    border: '1px solid #3c3c4a',
                    color: '#f4f4f6',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cueframe-btn cueframe-btn-primary"
                  data-testid="save-cue-btn"
                  style={{ height: '26px', padding: '0 12px', fontSize: '11px' }}
                >
                  Save Cue
                </button>
              </div>
            </form>
          )}

          {/* Category Filter Pills */}
          <div
            style={{
              padding: '5px 10px',
              borderBottom: '1px solid var(--cueframe-border-subtle)',
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
            }}
            role="group"
            aria-label="Filter review cues by category"
          >
            {(['ALL', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className="cueframe-btn"
                data-active={filterCategory === cat}
                aria-pressed={filterCategory === cat}
                onClick={() => setFilterCategory(cat)}
                style={{ height: '20px', minWidth: 'auto', padding: '0 5px', fontSize: '10px' }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Scrollable Cue List */}
          <div
            role="list"
            aria-label="Timestamped review cues"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            {filteredCues.length === 0 ? (
              <div style={{ padding: '12px 6px', textAlign: 'center', fontSize: '11px', color: 'var(--cueframe-text-muted)' }}>
                No review cues in this filter. Press <strong>N</strong> to flag the current frame.
              </div>
            ) : (
              filteredCues.map((cue) => {
                const isEditing = editingCueId === cue.id;
                return (
                  <div
                    key={cue.id}
                    role="listitem"
                    data-testid={`review-cue-item-${cue.id}`}
                    style={{
                      padding: '6px 8px',
                      background: '#131318',
                      border: '1px solid #272733',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      opacity: cue.resolved ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <button
                        type="button"
                        className="cueframe-btn cueframe-tabular"
                        onClick={() => onSeekToCue(cue.timestamp)}
                        aria-label={`Jump to cue at ${formatSmpteTimecode(cue.timestamp, fps)}`}
                        style={{
                          height: '20px',
                          minWidth: 'auto',
                          padding: '0 5px',
                          fontSize: '10px',
                          background: 'rgba(229, 169, 60, 0.16)',
                          color: '#e5a93c',
                        }}
                      >
                        {formatSmpteTimecode(cue.timestamp, fps)}
                      </button>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: '#09090c',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          color:
                            cue.category === 'Picture'
                              ? 'var(--cueframe-cue-picture)'
                              : cue.category === 'Edit'
                                ? 'var(--cueframe-cue-edit)'
                                : cue.category === 'Sound'
                                  ? 'var(--cueframe-cue-sound)'
                                  : 'var(--cueframe-cue-fix)',
                        }}
                      >
                        {cue.category}
                      </span>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input
                          type="text"
                          className="cueframe-input"
                          aria-label="Edit review cue note"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '3px 6px',
                            fontSize: '11px',
                            background: '#09090b',
                            color: '#fff',
                            border: '1px solid var(--media-accent-color)',
                            borderRadius: '3px',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                          <button
                            type="button"
                            className="cueframe-btn cueframe-btn-primary"
                            onClick={() => {
                              if (editingText.trim()) {
                                onUpdateCue(cue.id, { note: editingText.trim() });
                              }
                              setEditingCueId(null);
                            }}
                            style={{ height: '20px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="cueframe-btn"
                            onClick={() => setEditingCueId(null)}
                            style={{ height: '20px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '11px',
                          color: '#f4f4f6',
                          textDecoration: cue.resolved ? 'line-through' : 'none',
                          wordBreak: 'break-word',
                        }}
                      >
                        {cue.note}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: '#a1a1aa', fontWeight: 500 }}>{cue.author}</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          type="button"
                          className="cueframe-btn"
                          aria-label={cue.resolved ? 'Reopen cue' : 'Mark cue resolved'}
                          onClick={() => onUpdateCue(cue.id, { resolved: !cue.resolved })}
                          style={{ height: '18px', minWidth: 'auto', padding: '0 4px', fontSize: '9px' }}
                        >
                          {cue.resolved ? 'Reopen' : 'Resolve'}
                        </button>
                        <button
                          type="button"
                          className="cueframe-btn"
                          aria-label={`Edit cue at ${formatSmpteTimecode(cue.timestamp, fps)}`}
                          onClick={() => {
                            setEditingCueId(cue.id);
                            setEditingText(cue.note);
                          }}
                          style={{ height: '18px', minWidth: 'auto', padding: '0 4px', fontSize: '9px' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cueframe-btn"
                          aria-label={`Delete cue at ${formatSmpteTimecode(cue.timestamp, fps)}`}
                          onClick={() => onDeleteCue(cue.id)}
                          style={{ height: '18px', minWidth: 'auto', padding: '0 4px', fontSize: '9px', color: '#fb7185' }}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Export Footer */}
          <div
            style={{
              padding: '6px 10px',
              borderTop: '1px solid var(--cueframe-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(0, 0, 0, 0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--cueframe-text-secondary)', fontWeight: 600 }}>
                EXPORT CUT LIST:
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="export-markdown-btn"
                  onClick={() =>
                    triggerDownloadOrCopy(
                      exportCuesToMarkdown(cues, { title: productionTitle, fps }),
                      'cueframe-review-notes.md',
                      'Markdown'
                    )
                  }
                  style={{ height: '22px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="export-csv-btn"
                  onClick={() =>
                    triggerDownloadOrCopy(exportCuesToCsv(cues, fps), 'cueframe-review-notes.csv', 'CSV')
                  }
                  style={{ height: '22px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="export-edl-btn"
                  onClick={() =>
                    triggerDownloadOrCopy(
                      exportCuesToEdl(cues, { title: productionTitle, fps }),
                      'cueframe-review-notes.edl',
                      'CMX 3600 EDL'
                    )
                  }
                  style={{ height: '22px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
                >
                  EDL
                </button>
              </div>
            </div>
            {exportStatus && (
              <div
                role="status"
                data-testid="export-status-banner"
                style={{ fontSize: '10px', color: '#4ade80', textAlign: 'right' }}
              >
                {exportStatus}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
