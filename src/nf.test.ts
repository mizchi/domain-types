type NonAsyncFn<T extends any[] = any[], R = any> = (
  ...args: T
) => R extends Promise<any> ? never : R;

function def<T extends NonAsyncFn>(_fn: T) {}

def((x: number) => x * 2);
def((x: number) => Promise.resolve(x * 2));
