declare module "incremental-dom" {
  export function elementOpen(tag: string, key?: string, statics?: any[], ...varArgs: any[]): any;
  export function elementClose(tag: string): any;
  export function elementVoid(tag: string, key?: string, statics?: any[], ...varArgs: any[]): any;
  export function elementOpenStart(tag: string, key?: string, statics?: any[]): void;
  export function elementOpenEnd(): any;
  export function attr(name: string, value: any): void;
  export function text(value: any, ...varArgs: any[]): void;
  export function patch(node: Element, fn: (...args: any[]) => void, data?: any): void;
}
