import { getAdminToken } from './adminFetch';

export function subscribeSseStream(
  url: string,
  options: {
    withAdminAuth?: boolean;
    onEvent: (eventName: string, data: unknown) => void;
    onError?: () => void;
  }
): () => void {
  const controller = new AbortController();
  let stopped = false;

  async function connect() {
    while (!stopped) {
      try {
        const headers = new Headers();
        if (options.withAdminAuth) {
          const token = getAdminToken();
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        }

        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers,
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          options.onError?.();
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            if (!block.trim() || block.startsWith(':')) continue;
            let eventName = 'message';
            let dataRaw = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataRaw += line.slice(5).trim();
              }
            }
            if (eventName && dataRaw) {
              try {
                options.onEvent(eventName, JSON.parse(dataRaw));
              } catch {
                options.onEvent(eventName, dataRaw);
              }
            }
          }
        }
      } catch {
        if (stopped) return;
        options.onError?.();
      }

      if (!stopped) {
        await new Promise((r) => setTimeout(r, 3500));
      }
    }
  }

  void connect();

  return () => {
    stopped = true;
    controller.abort();
  };
}
