# @mizchi/domain-types

`@mizchi/domain-types` はドメインモデリングのためのTypeScriptユーティリティ群です。
このリポジトリは、Node.js (npm経由) と Deno (JSR経由) の両方で利用可能です。

## Result 型

Result 型は、成功 (Ok) または失敗 (Err) の可能性がある操作を処理する方法です。

### 主要な関数

- `ok(value)`: 成功の Result を作成します。
- `err(error)`: 失敗の Result を作成します。
- `assertOk(result)`: Result が Ok であることを表明し、その値にアクセスします。
- `assertErr(result)`: Result が Err であることを表明し、そのエラーにアクセスします。

### コア型

- `Ok<T>`: 成功時の値を保持する型。
- `Err<E>`: 失敗時のエラーを保持する型。
- `Result<T, E>`: `Ok<T>` または `Err<E>` のいずれかを表す型。

`ResultAssertError` は表明が失敗した場合にスローされるエラー型です。また、非同期操作をResult型でラップするためのヘルパー関数 `throwableAsync` も提供されています。

## Effect 型

Effect 型は、ジェネレータを使用して副作用を構造化された方法で管理するための仕組みです。

### エフェクトの定義

エフェクトは `eff(type, payload)` または `defineEff(type)` を使用して定義されます。

- `eff(type, payload)`: 特定のペイロードを持つエフェクトを作成します。
- `defineEff(type)`: 特定の型のエフェクト定義を作成するためのファクトリ関数です。

### プログラムの記述

プログラムは、エフェクトを `yield` するジェネレータ関数 (`Task` または `AsyncTask`) として記述されます。

- `Task<T, R>`: 同期的なジェネレータプログラムの型。`T` は `yield` されるエフェクトの型、`R` は最終的な返り値の型。
- `AsyncTask<T, R>`: 非同期的なジェネレータプログラムの型。

### エフェクトの実行

`perform` 関数（および `performResult`）は、これらのジェネレータプログラムを一連のハンドラと共に実行する役割を果たします。

- `perform(program, handlers)`: ジェネレータプログラムを実行し、`yield` された各エフェクトに対応するハンドラを呼び出します。
- `performResult(program, handlers)`: `perform` と同様ですが、最終結果を `Result` 型でラップして返します。

### ハンドラ

ハンドラは、キーがエフェクトの型（文字列）で、値がそのエフェクトの具体的な振る舞いを実装する関数であるオブジェクトです。

### ヘルパー型/関数

- `Eff<T, P>`: エフェクトの基本型。`T` はエフェクトの種類を示す文字列リテラル型、`P` はペイロードの型。
- `InferHandlers<TEffect>`: 特定のエフェクトセットに対応するハンドラの型を推論します。
- `defineHandlers`: ハンドラオブジェクトを型安全に定義するためのヘルパー関数です。
