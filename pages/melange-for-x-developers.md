# Melange for X developers

他の言語やプラットフォームに詳しい方は、Melange と他の言語やプラットフォームの比較セクションをご覧ください。

- JavaScript
- TypeScript
- Js_of_ocaml
- ReScript

## For JavaScript developers

Melange は表現力と安全性に重点を置いた、OCaml 上のレイヤー。強力な型システムで JavaScript アプリケーションを安全に構築・保守できるようにする。

Melange では OCaml または Reason 構文を使用してアプリケーションを構築できる。(Reason は OCaml と完全に互換性がある)

Reason では JSX をサポートしていて、ReasonReact のようなバインディングも用意されている。

### Cheat sheet

#### Variable

| JavaScript              | Reason                         |
| ----------------------- | ------------------------------ |
| `const x = 5;`          | `let x = 5`                    |
| `var x = y;`            | なし                           |
| `let x = 5; x = x + 1;` | `let x = ref(5); x := x^ + 1;` |

#### String / Character

| JavaScript         | Reason                      |
| ------------------ | --------------------------- |
| "Hello world!"     | 同じ                        |
| 'Hello world!'     | 文字列は`"`を使う必要がある |
| Character は文字列 | 'a'                         |
| "hello " + "world" | "hello" ++ "world"          |

#### Boolean

| JavaScript                         | Reason                                   |
| ---------------------------------- | ---------------------------------------- |
| `true`, `false`                    | 同じ                                     |
| `!true`                            | 同じ                                     |
| `\|\|`, `&&`, `<=`, `>=`, `<`, `>` | 同じ                                     |
| `a === b`, `a !== b`               | 同じ                                     |
| 深い等号なし（再帰的比較）         | `a == b`, `a != b`                       |
| `a == b`                           | 暗黙のキャスティングによる比較はできない |

#### Number

| JavaScript  | Reason       |
| ----------- | ------------ |
| `3`         | 同じ\*       |
| `3.1415`    | 同じ         |
| `3 + 4`     | 同じ         |
| `3.0 + 4.5` | `3.0 +. 4.5` |
| `5 % 3`     | `5 mod 3`    |

- JavaScript では integer と float の区別はない

#### Object / Record

| JavaScript            | Reason                                   |
| --------------------- | ---------------------------------------- |
| 静的型なし            | `type point = { x: int, mutable y: int ` |
| `{x: 30, y: 20}`      | 同じ                                     |
| `point.x`             | 同じ                                     |
| `point.y = 30;`       | 同じ                                     |
| `{ ...point, x: 30 }` | 同じ                                     |

#### Array

| JavaScript           | Reason             |
| -------------------- | ------------------ |
| `[1, 2, 3]`          | `[\| 1, 2, 3 \|]`  |
| `myArray[1] = 10`    | 同じ               |
| `[1, "Bob", true]`\* | `(1, "Bob', true)` |
| 不変リストなし       | `[1, 2, 3]`        |

- JavaScript の配列は複数のタイプの要素を含むことができるため、タプルは JavaScript の配列でシミュレートすることができる。

#### Null

| JavaScript          | Reason   |
| ------------------- | -------- |
| `null`, `undefined` | `None`\* |

- OCaml には`null`もそれに起因するバグもない。しかし、実際に必要な場合のために、[Option 型](https://reasonml.github.io/docs/en/option)が用意されている。

#### Function

| JavaScript                      | Reason                     |
| ------------------------------- | -------------------------- |
| `arg => retval`                 | `(arg) => retval`          |
| `function f = function(arg) {}` | `let named = (arg) => ...` |
| `const f = function(arg) {}`    | `let f = (arg) => ...`     |
| `add(4, add(5, 6))`             | 同じ                       |

#### Blocks

JavaScript:

```js
const myFun = (x, y) => {
  const doubleX = x + x
  const doubleY = y + y
  return doubleX + doubleY
}
```

```ocaml
let myFun = (x, y) => {
  let doubleX = x + x;
  let doubleY = y + y;
  doubleX + doubleY;
}
```

#### Currying

| JavaScript                  | Reason                      |
| --------------------------- | --------------------------- |
| `let add = a => b => a + b` | `let add = (a, b) => a + b` |

JavaScript も OCaml も currying をサポートしているが、OCaml の currying はビルトインで、可能な限り中間関数の割り当てと呼び出しを避けるように最適化されている。

#### If-else

| JavaScript                | Reason                            |
| ------------------------- | --------------------------------- |
| `if (a) { b } else { c }` | 同じ                              |
| `a ? b : c`               | 同じ                              |
| `switch`                  | `switch` ただしパターンマッチング |

#### Destructuring

| JavaScript                      | Reason                        |
| ------------------------------- | ----------------------------- |
| `const {a, b} = data`           | `let {a, b} = data`           |
| `const [a, b] = data`           | `let [\| a, b \|] = data` \*  |
| `const { a: aa, b: bb } = data` | `let { a: aa, b: bb } = data` |

- この場合、コンパイラーは、データが 2 以外の長さである可能性があるため、すべてのケースが処理されていないと警告する。

#### Loop

| JavaScript                            | Reason                         |
| ------------------------------------- | ------------------------------ |
| `for (let i = 0; i <= 10; i++) {...}` | `for (i in 0 to 10) {...}`     |
| `for (let i = 10; i >= 0; i--) {...}` | `for (i in 10 downto 0) {...}` |
| `while (true) {...}`                  | Same                           |

#### JSX

| JavaScript                             | Reason                   |
| -------------------------------------- | ------------------------ |
| `<Foo bar=1 baz="hi" onClick={bla} />` | Same                     |
| `<Foo bar=bar />`                      | `<Foo bar />` \*         |
| `<input checked />`                    | `<input checked=true />` |
| No children spread                     | `<Foo>...children</Foo>` |

- エレメントを作成する際の引数の洒落に注意

#### Exception

| JavaScript                                | Reason                        |
| ----------------------------------------- | ----------------------------- |
| `throw new SomeError(...)`                | `raise(SomeError(...))`       |
| `try {a} catch (Err) {...} finally {...}` | `try (a) { \| Err => ...}` \* |

- finally はない

#### Blocks

OCaml では、「シーケンス式」は`{}`で作成され、最後のステートメントで評価される。JavaScript では、これは即座に呼び出される関数式でシミュレートできます（関数本体は独自のローカルスコープを持つため）。

JavaScript:

```js
let res = (function () {
  const x = 23
  const y = 34
  return x + y
})()
```

Reason:

```ocaml
let res = {
  let x = 23;
  let y = 34;
  x + y;
};
```

#### Comments

| JavaScript        | Reason |
| ----------------- | ------ |
| `/* Comment */`   | 同じ   |
| `// Line Comment` | 同じ   |

## For TypeScript developers

Melange を使ったアプリケーションの型付けのアプローチは、TypeScript とは多少異なります。TypeScript はその設計目標にあるように、JavaScript との互換性に重点を置いて設計されている。一方、Melange は OCaml をベースに構築されており、表現力と安全性を重視したコンパイラとして知られている。

両者にはいくつかの違いがある。

### 型推論

TypeScript では引数の型を定義しなければならない：

```ts
let sum = (a: number, b: number) => a + b
```

OCaml では型アノテーションをほとんど使わなくても型を推論することができる。例えば、2 つの数値を加算する関数を次のように定義できる：

```ocaml
let add = (x, y) => x + y;
```

### 代数的データ型

TypeScript で OCaml と同じように ADT を構築することはできない。[判別可能なユニオン](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)が最も近い類型であり、[ts-pattern](https://github.com/gvergnaud/ts-pattern)のようなライブラリがパターンマッチをサポートしていない言語の代替となるだろう。

OCaml では、[代数的データ型（ADT）](https://cs3110.github.io/textbook/chapters/data/algebraic_data_types.html)はよく使われる機能である。これによって、小さなブロックから独自の型を構築することができる。そして、パターン・マッチを使えば、このデータに簡単にアクセスできる。

### Nominal 型付け

TypeScript では、型付けはすべて構造的である。つまり、同じ実装を持つ 2 つの型の間に境界や分離を設けるのが難しい場合がある。このような場合、タグを使用してノミナル型付けをエミュレートすることができる：

```ts
type Email = string & { readonly __tag: unique symbol }
type City = string & { readonly __tag: unique symbol }
```

OCaml では、ノミナル型が完全にサポートされている。[レコードやバリアント](https://v2.ocaml.org/manual/coreexamples.html#s%3Atut-recvariants)のようなコアとなる型はノミナル型である。これは、まったく同じ型を 2 回宣言したとしても、一方の型の値を操作する関数はもう一方の型と互換性がないことを意味する。

OCaml [オブジェクト](https://v2.ocaml.org/manual/objectexamples.html)や[ポリモーフィック・バリアント](https://v2.ocaml.org/manual/polyvariant.html)に使われる構造的型付けもある。

### Immutability

TypeScript には、不変性を扱うための 2 つの基本プリミティブがある。`const`、`readonly`

最初のプリミティブは、変数の参照が変更されるのを防ぐために使用される。

```ts
const a = 1
a = 2 // Error: Cannot assign to 'a' because it is a constant.
```

二つ目はプロパティをイミュータブルにするために使用する。

```ts
type A = {
  readonly x: number
}

const a: A = { x: 1 }
a.x = 12 // Error: Cannot assign to 'x' because it is a read-only property.
```

`const`と`readonly`は参照の変更をブロックするだけで、値については何もしない。`const a = [1, 2, 3]`や`readonly x: number[]`を使っても、配列の中身を変更することはできる。

OCaml は、リスト、レコード、マップのような不変性を考慮したデータ型を提供している。

### 厳密性と健全性

TypeScript では、`any`のような型や、`Function`のような拡張的な型を柔軟に使うことができる。しかし、TypeScript では tsconfig.json ファイルに strict オプションが用意されており、これらの型安全性の低い構造の使用を緩和することができる。一方、OCaml には厳密性を有効/無効にする同様のオプションはない。OCaml では、より厳格な動作を強制するための明示的な設定オプションを必要とせず、言語自体が型安全性を促進する。

TypeScript は、[ハンドブック](https://www.typescriptlang.org/docs/handbook/type-compatibility.html#a-note-on-soundness)で言及されているように、必要に応じて、実用性のために健全性を犠牲にすることがある。対照的に、OCaml の実装は[`identity`プリミティブ](https://melange.re/v2.2.0/communicate-with-javascript/#special-identity-external)のような不健全なメソッドを提供しているが、一般的には推奨されておらず、ほとんど使われていない。OCaml コミュニティは健全性を維持することに強い重点を置いており、コードの正しさを保証するために、より安全な代替手段を好んでいる。

### Cheat sheet

以下は、TypeScript と OCaml のイディオム間の変換である。OCaml 側では、JavaScript 開発者向けのセクションで述べたように、馴染みやすいように Reason 構文を使っている。

#### 型エイリアス

| TypeScript             | Reason                 |
| ---------------------- | ---------------------- |
| `type Email = string;` | `type email = string;` |

#### 抽象型

TypeScript:

```ts
type Email = string & { readonly __tag: unique symbol }
```

Reason:

```ocaml
/* in interface `rei` file */
type email;

/* in implementation `re` file */
type email = string;
```

#### Union 型 / Variants

TypeScript:

```ts
type Result = 'Error' | 'Success'

type Result =
  | { type: 'Error'; message: string }
  | { type: 'Success'; message: string }
```

Reason:

```ocaml
type Result =
  | Error
  | Success

type result =
  | Error(string)
  | Success(string)
```

#### Immutabiliity

TypeScript:

```ts
const a = 1

type A = { readonly x: number }
type ImmutableA = Readonly
const arr: ReadonlyArray = [1, 2, 3]
type A = { readonly [x: string]: number }
```

OCaml ではデフォルトで Immutable。

#### Currying

TypeScript:

```ts
type addT = (_: number) => (_: number) => number
const add: addT = l => r => l + r

add(5)(3)
```

OCaml ではデフォルトで有効

#### Parametric polymorphism

| TypeScript                             | Reason                         |
| -------------------------------------- | ------------------------------ |
| `type length = <T>(_: T[]) => number;` | `let length: list('a) => int;` |
