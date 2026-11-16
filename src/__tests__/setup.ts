import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, vi } from 'vitest';

// Initialize JSDOM directly inside the connected project workspace
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

const win = dom.window as unknown as Window & typeof globalThis;

// Provide a deterministic, standards-compliant in-memory Storage implementation
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memoryLocalStorage = new MemoryStorage();

Object.defineProperty(win, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryLocalStorage,
});

const domGlobals: Record<string, unknown> = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  AbortController: win.AbortController,
  AbortSignal: win.AbortSignal,
  HTMLElement: win.HTMLElement,
  HTMLVideoElement: win.HTMLVideoElement,
  HTMLMediaElement: win.HTMLMediaElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLButtonElement: win.HTMLButtonElement,
  SVGElement: win.SVGElement,
  Element: win.Element,
  Node: win.Node,
  Text: win.Text,
  Event: win.Event,
  CustomEvent: win.CustomEvent,
  MouseEvent: win.MouseEvent,
  KeyboardEvent: win.KeyboardEvent,
  FocusEvent: win.FocusEvent,
  PointerEvent: win.MouseEvent,
  MutationObserver: win.MutationObserver,
  DocumentFragment: win.DocumentFragment,
  Range: win.Range,
  localStorage: memoryLocalStorage,
  getComputedStyle: win.getComputedStyle.bind(win),
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
};

for (const [key, value] of Object.entries(domGlobals)) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

await import('@testing-library/jest-dom/vitest');
const { cleanup } = await import('@testing-library/react');

beforeEach(() => {
  memoryLocalStorage.clear();

  Object.defineProperty(win.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, value: false });
      this.dispatchEvent(new win.Event('play'));
      return Promise.resolve();
    }),
  });

  Object.defineProperty(win.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, value: true });
      this.dispatchEvent(new win.Event('pause'));
    }),
  });

  Object.defineProperty(win.HTMLMediaElement.prototype, 'audioTracks', {
    configurable: true,
    writable: true,
    value: Object.assign([], {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });

  Object.defineProperty(win, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});
