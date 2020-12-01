export function numCores() {
  return navigator.hardwareConcurrency;
}

export function isWorker() {
  return 'document' in self;
}