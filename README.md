# @mizchi/domain-types

typescript utilities for domain modeling

## Install

```bash
# node
$ npm add @mizchi/domain-types
# deno
$ deno add jsr:@mizchi/domain-types
```

## Effect Generator

Thin effect-system like generator nspired by https://effect.website/ and https://koka-lang.github.io/koka/doc/index.html

### simple usecase

```ts
import {
  type EffectFor,
  defineEffect,
  performAsync,
} from "@mizchi/domain-types";

const log = defineEffect<
  // unique effect key
  "log",
  // parameter types
  [message: string],
  // return type
  void
>("log");
const val = defineEffect<"val", [], number>("val");
type ProgramEffect = EffectFor<typeof log> | EffectFor<typeof val>;

async function* program(): AsyncGenerator<ProgramEffect> {
  const v = yield* val(); // return by handler
  yield* log(`v:${v}`);
}

// with 42
console.log(
  await Array.fromAsync(
    // AsyncGenerator
    performAsync(program(), {
      // run program with handlers
      [log.t]: async (message) => {
        console.log(`[log] ${message}`);
      },
      [val.t]: async () => {
        return 42;
      },
    })
  )
);
// [log] v:42
// => [ [ "val", [], 42 ], [ "log", [ "v:42" ], undefined ] ]

// with 10 and logger
console.log(
  await Array.fromAsync(
    performAsync(program(), {
      [log.t]() {},
      [val.t]: async () => {
        return 10;
      },
    })
  )
);
// => [ [ "val", [], 10 ], [ "log", [ "v:10" ], undefined ] ]
```

### sub task

```ts
import {
  type EffectFor,
  type AsyncHandlersFor,
  type ResultStep,
  defineEffect,
  performAsync,
} from "@mizchi/domain-types";

const log = defineEffect<"log", [message: string], void>("log");
const delay = defineEffect<"delay", [ms: number], void>("delay");
const val = defineEffect<"val", [], number>("val");
type ProgramEffect =
  | EffectFor<typeof log>
  | EffectFor<typeof delay>
  | EffectFor<typeof val>;

function* subTask(): Generator<EffectFor<typeof log> | EffectFor<typeof val>> {
  yield* log("sub");
  const v = yield* val();
  // yield* delay(100); // You can yield only Generator<T> or AsyncGenerator<T>
  return v + 1;
}

async function* program(): AsyncGenerator<ProgramEffect> {
  yield* log("start");
  const v = yield* subTask();
  yield* log(`returned: ${v}`);
}

// run with handlers
const handlers: AsyncHandlersFor<ProgramEffect> = {
  [log.t]: async (message) => {
    console.log(`[log] ${message}`);
  },
  [delay.t]: async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  },
  [val.t]: async () => {
    return 42;
  },
};

// Execute the program
const steps: ResultStep<ProgramEffect>[] = await Array.fromAsync(
  performAsync(program(), handlers)
);
console.log("Program steps:", steps);
/** * Output:
[log] start
[log] sub
[log] subTask returned: 43
Program steps: [
  [ "log", [ "start" ], undefined ],
  [ "log", [ "sub" ], undefined ],
  [ "val", [], 42 ],
  [ "log", [ "returned: 43" ], undefined ]
]
*/
```

### sync and async

- `perform(Generator<T, R, N>, {...})`
- `performAsync(AsyncGenerator<T, R, N>, {...})`

```ts
// sync example
// All handlers and generator should be sync in perform()
import { type EffectFor, defineEffect, perform } from "@mizchi/domain-types";

const val = defineEffect<"val", [], number>("val");
type ProgramEffect = EffectFor<typeof val>;
function* program(): Generator<ProgramEffect> {
  yield* val();
}

console.log(
  ...perform(program(), {
    [val.t]: () => 42,
  })
);
// => [ "val", [], 42 ]
```

## Understanding the Effect System (エフェクトシステムの解説)
**エフェクトシステムのコアコンセプト**

`@mizchi/domain-types` におけるエフェクトシステムは、JavaScript/TypeScriptアプリケーションにおける副作用を管理するための強力なメカニズムです。副作用とは、以下のような外部の世界と相互作用する操作のことです。

*   ネットワークリクエスト（例：API呼び出し）
*   ファイルへの読み書き
*   データベースとのやり取り
*   ロギング
*   乱数生成
*   現在時刻の取得

**エフェクトシステムとは？**

本質的に、エフェクトシステムは副作用の *記述* とその *実行* を分離する方法を提供します。

1.  **エフェクトの記述:** ビジネスロジックのコードは直接副作用を実行しません。代わりに、実行したいエフェクトの記述を `yield` します。これらの記述は、操作のタイプと必要なパラメータを指定する単純なオブジェクトまたはデータ構造（「エフェクト」と呼ばれます）です。例えば、直接 `fetch()` を呼び出す代わりに、コードは `{ type: 'networkRequest', url: '...' }` のようなエフェクトを `yield` するかもしれません。

2.  **エフェクトの実行（ハンドリング）:** 「インタープリタ」または「ハンドラ」と呼ばれるシステムの別の部分が、これらの `yield` されたエフェクト記述を受け取り、実際にそれらを実行します。このハンドラは、実際のネットワークリクエストの作成方法、実際のファイルの読み取り方法などを知っています。

**なぜエフェクトシステムを使用するのか？**

この分離は、いくつかの大きな利点をもたらします。

*   **テスト容易性の向上:**
    *   コアビジネスロジックが純粋になり、テストが容易になります。エフェクトの記述を `yield` するだけなので、実際のネットワーク呼び出し、ファイルシステム、その他の外部依存関係をモックする必要なく、それが `yield` するエフェクトを確認するだけでテストできます。
    *   テスト中にハンドラを簡単に交換できます。例えば、本番環境で実際のHTTPリクエストを行うハンドラを、テストでは事前定義されたデータを返すモックハンドラに置き換えることができます。

*   **構成可能性の強化:**
    *   エフェクトは柔軟な方法で構成および結合できます。エフェクトを順序付けて複雑なワークフローを構築できます。
    *   異なる環境や異なる目的のために、異なるハンドラのセットを使用できます（例：開発中はコンソールに書き込むロギングハンドラを、本番環境ではリモートサービスに書き込むハンドラにする）。

*   **明確性と保守性の向上:**
    *   副作用を伴う操作が関数呼び出しの中に隠されるのではなく、明示的に宣言されるため、ビジネスロジックの意図がより明確になります。
    *   コードが `yield` するエフェクトのタイプを見ることで、コードが実行できる副作用について推論しやすくなります。

*   **より良い並行性制御（非同期操作の場合）:**
    *   エフェクトシステムは、非同期操作を管理するための構造化された方法を提供でき、キャンセレーション、リトライ、または並列実行などを扱いやすくしますが、詳細は実装に依存します。

`@mizchi/domain-types` では、これはJavaScriptのジェネレータ関数を使用して実現されます。関数はエフェクトオブジェクトを `yield` し、`perform` または `performAsync` 関数が、提供されたハンドラと共にこれらのエフェクトの実行を処理します。

### `@mizchi/domain-types` におけるエフェクトシステムの使用方法
`@mizchi/domain-types` ライブラリは、エフェクトシステムを実装するためのいくつかの主要な関数と型を提供します。

1.  **`defineEffect<Key, Args, ReturnType>(key: Key)`**
    *   これは新しいタイプのエフェクトを宣言するための主要な関数です。
    *   `Key`: エフェクトを識別する一意の文字列リテラル型（例: `"log"`、`"readFile"`）。このキーは、ハンドラがエフェクトの処理方法を決定するために使用されます。
    *   `Args`: このエフェクトが取る引数を表すタプル型（例: ログエフェクトの場合は `[message: string]`、ファイル読み取りエフェクトの場合は `[filePath: string]`）。引数が必要ない場合はデフォルトで `[]` になります。
    *   `ReturnType`: このエフェクトのハンドラが生成すると期待され、ジェネレータに返される値の型。デフォルトは `void | undefined` です。
    *   `defineEffect` は「エフェクトビルダー」を返します。これはジェネレータ内でエフェクトを `yield` するために呼び出す関数です。このビルダーは、ハンドラを定義するのに役立つ `Key` を保持する `.t` プロパティも持っています。
    ```typescript
    import { defineEffect } from "@mizchi/domain-types";

    // 文字列メッセージを受け取り、何も返さない "log" エフェクトを定義します。
    const log = defineEffect<"log", [message: string], void>("log");

    // ユーザーID（数値）を受け取り、Userオブジェクト（非同期の場合はPromise<User>）を
    // 返すと期待される "getUser" エフェクトを定義します。
    // interface User { id: number; name: string; } // User型が定義されていると仮定
    const getUser = defineEffect<"getUser", [userId: number], User>("getUser");
    ```

2.  **`EffectFor<typeof anEffectBuilder>`**
    *   これは `defineEffect` によって作成されたエフェクトビルダーから実際の `Effect` 型を抽出するユーティリティ型です。
    *   特定のジェネレータ関数（プログラム）が `yield` できるすべての可能なエフェクトの合併型を作成するのに役立ちます。
    ```typescript
    import { type EffectFor } from "@mizchi/domain-types";
    // 上記のようにlogとgetUserが定義されていると仮定
    // interface User { id: number; name: string; }

    type MyProgramEffects = EffectFor<typeof log> | EffectFor<typeof getUser>;
    ```

3.  **`perform(generator, handlers)` と `performAsync(generator, handlers)`**
    *   これらの関数は、エフェクトフルなプログラムを実行する「インタープリタ」です。
    *   `generator`: エフェクトを `yield` するジェネレータ関数のインスタンス（例: `program()`）。
    *   `handlers`: キーがエフェクトキー（例: `log.t`）で、値がそれらのエフェクトを処理するロジックを実装する関数であるオブジェクト。
        *   `perform`: ジェネレータとそのすべてのエフェクトハンドラが同期的な場合に使用されます。
        *   `performAsync`: ジェネレータまたはいずれかのエフェクトハンドラが非同期（Promiseを返す）である場合に使用されます。
    *   ジェネレータがエフェクトを `yield` すると、`perform` または `performAsync` 関数がそれを傍受し、対応するハンドラ関数を見つけ、エフェクトの引数でそれを実行し、そしてハンドラの戻り値をジェネレータに返します。
    *   これらの関数は `ResultStep` オブジェクトを `yield` するイテレータ/非同期イテレータを返します。これは `[effectKey, args, returnValue]` のタプルであり、エフェクトの流れを検査することができます。

4.  **`HandlersFor<EffectsUnion>` と `AsyncHandlersFor<EffectsUnion>`**
    *   これらのユーティリティ型は、型安全性を備えたハンドラオブジェクトの形状を定義するのに役立ちます。
    *   `HandlersFor`: `perform` で使用される同期ハンドラ用。
    *   `AsyncHandlersFor`: `performAsync` で使用される非同期（または同期/非同期混合）ハンドラ用。
    ```typescript
    import { type AsyncHandlersFor } from "@mizchi/domain-types";
    // MyProgramEffectsと必要なエフェクトビルダー（log、getUser）が定義されていると仮定
    // interface User { id: number; name: string; }

    const myHandlers: AsyncHandlersFor<MyProgramEffects> = {
      [log.t]: async (message) => {
        console.log(message);
      },
      [getUser.t]: async (userId) => {
        // const response = await fetch(`/api/users/${userId}`);
        // return response.json();
        return { id: userId, name: "Mock User" } as User; // 例
      },
    };
    ```

**動作の仕組み（簡略化されたフロー）:**
```
あなたのジェネレータ関数        performAsync / perform             あなたのハンドラ
----------------------        ----------------------             -------------
yield* someEffect(arg)  -----> `someEffect` を傍受
                              ハンドラ内で `someEffect.t` を検索
                              handler[someEffect.t](arg) を呼び出す ----> 実際のロジックを実行
                                                                       (例: console.log, fetch)
                        <----- ハンドラから結果を返す <-------------------- 結果を返す
結果を受け取り、
実行を続ける
```

### 簡潔なコード例
データを取得してログに記録する簡単なプログラムで説明しましょう。
```typescript
import {
  defineEffect,
  type EffectFor,
  type AsyncHandlersFor,
  performAsync,
  type ResultStep
} from "@mizchi/domain-types";

// 0. 例のためのプレースホルダーUser型を定義 (この例では実際には使われません)
// interface User { id: number; name: string; }

// 1. エフェクトを定義
const fetchData = defineEffect<"fetchData", [id: string], { data: string }>("fetchData");
const logMessage = defineEffect<"logMessage", [message: string], void>("logMessage");

// 2. プログラムが使用できるすべてのエフェクトの型を定義
type AppEffects = EffectFor<typeof fetchData> | EffectFor<typeof logMessage>;

// 3. ジェネレータ関数を使用してプログラムを作成
async function* myProgram(itemId: string): AsyncGenerator<AppEffects, string> {
  yield* logMessage("プログラムを開始します...");
  const result = yield* fetchData(itemId);
  yield* logMessage(`受信データ: ${result.data}`);
  return `アイテム ${itemId} の処理に成功しました。`;
}

// 4. エフェクトのハンドラを作成
const myAppHandlers: AsyncHandlersFor<AppEffects> = {
  [fetchData.t]: async (id) => {
    // 実際のアプリでは、これはネットワークリクエストになります。例: fetch(`https://api.example.com/items/${id}`)
    console.log(`[ハンドラ] IDのデータを取得中: ${id}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // 非同期処理をシミュレート
    return { data: `ID ${id} のサンプルデータ` };
  },
  [logMessage.t]: async (message) => {
    console.log(`[ハンドラ] LOG: ${message}`);
  },
};

// 5. プログラムを実行
async function main() {
  const itemIdToProcess = "item-123";

  console.log("プログラムを実行中...");
  const executionResult = performAsync(myProgram(itemIdToProcess), myAppHandlers);

  const steps: ResultStep<AppEffects>[] = [];
  for await (const step of executionResult) {
    steps.push(step);
  }

  console.log("\n--- プログラム実行トレース ---");
  steps.forEach(step => {
    console.log(`エフェクト: ${step[0]}, 引数: ${JSON.stringify(step[1])}, 返り値: ${JSON.stringify(step[2])}`);
  });
}

main().catch(console.error);

/* 期待される出力（ハンドラのログとトレースの順序は非同期性のため若干異なる場合があります）:

プログラムを実行中...
[ハンドラ] LOG: プログラムを開始します...
[ハンドラ] IDのデータを取得中: item-123
[ハンドラ] LOG: 受信データ: ID item-123 のサンプルデータ

--- プログラム実行トレース ---
エフェクト: logMessage, 引数: ["プログラムを開始します..."], 返り値: undefined
エフェクト: fetchData, 引数: ["item-123"], 返り値: {"data":"ID item-123 のサンプルデータ"}
エフェクト: logMessage, 引数: ["受信データ: ID item-123 のサンプルデータ"], 返り値: undefined
*/
```

### 「Epistem」およびバージョン0.0.8に関する注記
リクエストには「0.0.8で実装されたエフェステムについて解説し」とありました。コードベース（`README.md`、`src/` 内のソースファイル、`examples/` 内の例、`spec/` 内のテストを含む）を徹底的にレビューした結果、特定の用語「epistem」は見つかりませんでした。同様に、この用語を明確にする可能性のあるバージョン0.0.8に関する詳細な歴史的変更履歴や特定のリリースノートもリポジトリには存在しませんでした。

上記の説明は、副作用を管理するために `@mizchi/domain-types` で実装されている主要なアーキテクチャパターンである「エフェクトシステム」（「代数的エフェクト風システム」または「effect-ts風システム」とも呼ばれることがあります）について記述しています。このシステムにより、副作用を伴う操作の宣言とその実行を分離することができ、詳述したように、よりテスト可能で保守しやすいコードにつながります。

もし「epistem」が以下を指す場合：
*   このエフェクトシステムの特定の側面または異なる解釈、
*   このプロジェクトに影響を与えたライブラリ（`effect.website` や Koka など）の概念、
*   現在のソースでは直接見えない、異なる名前で呼ばれていたか、以前のイテレーション（おそらくバージョン0.0.8頃）の一部であった機能、
追加のコンテキストや詳細を提供していただければ幸いです。これにより、ご関心のある正確な概念を特定するのに役立ちます。現在の説明は、利用可能なソースコードに実装され、文書化されているエフェクトシステムに焦点を当てています。

## Result

Simple result types with asserts inspired by https://github.com/supermacro/neverthrow

```ts
import {
  ok,
  err,
  assertErr,
  assertOk,
  type Result,
} from "@mizchi/domain-types";

function getValue(v: number): Result<string, string> {
  if (v > 0) {
    return ok("Value is positive");
  }
  return err("Value must be positive");
}

Deno.test("Result", () => {
  const result: Result<string, string> = getValue(5);
  if (result.ok) {
    const _: string = result.value;
  } else {
    const _: string = result.error;
  }
});

Deno.test("Result: ok case", () => {
  const result = getValue(10);
  // @ts-expect-error
  result.value;
  assertOk(result);
  console.log(result.value);
});

Deno.test("Result: err case", () => {
  const result = getValue(-5);
  // @ts-expect-error
  result.error;
  assertErr(result);
  console.log(result.error);
});
```

## Error

```ts
import { assertErrorInstance } from "@mizchi/domain-types";
Deno.test("assertError", () => {
  class MyError extends Error {}
  const e = new MyError("test error") as any;
  assertErrorInstance(e, MyError);
  const _: MyError = e; // should not throw
});
```

## LICENSE

MIT
