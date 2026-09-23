/** Limits concurrent thumbnail fetches to avoid network saturation on large grids. */
const MAX_CONCURRENT = 6;
let inFlight = 0;
const queue: Array<() => void> = [];

export function runThumbnailTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      inFlight++;
      task()
        .then(resolve, reject)
        .finally(() => {
          inFlight--;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (inFlight < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}
