import * as events from 'events';
import * as path from 'path';
// global emitter for all your progress needs.
let globalEmitter: events.EventEmitter;

export const emitter = () => {
  if (!globalEmitter) {
    globalEmitter = new events.EventEmitter();
  }
  return globalEmitter;
};

export const logger = (file: string) => {
  file = file.replace(path.dirname(__dirname), '');
  // tslint:disable-next-line:no-any
  return (args: any[]) => {
    if (!globalEmitter) return;
    globalEmitter.emit('log', file, args);
  };
};