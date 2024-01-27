# JavaScript とのコミュニケーション

Melange は JavaScript との相互運用性が非常に高く、外部の JavaScript コードを利用するための様々な機能を提供しています。これらのテクニックを学ぶために、まず言語コンセプトについて説明し、次に Melange の型が JavaScript のランタイム型にどのようにマッピングされるかを見ていきます。最後に、JavaScript とのコミュニケーション方法を示すために、さまざまな使用例を例として示します。

## 言語のコンセプト

以下のセクションで説明する概念は、OCaml 言語のごく一部です。しかし、JavaScript とのコミュニケーション方法と、そのために Melange が提供する機能を理解する上では不可欠です。

### Attributes and extension nodes

JavaScript と相互作用するために、Melange はこれらの相互作用を表現するブロックを提供するように言語を拡張する必要があります。

例えば、そのために新しい構文構造（キーワードなど）を導入するのも 1 つの方法です：

```text
javascript add : int -> int -> int = {|function(x,y){
  return x + y
}|}
```

しかし、これでは Melange の主な目標のひとつである OCaml との互換性が壊れてしまいます。

幸いなことに、OCaml はパーサーや言語との互換性を壊すことなく言語を拡張するメカニズムを提供しています。これらのメカニズムは 2 つの部分で構成されています：

- 第 1 に、拡張または置換されるコード部分を定義するための構文追加
- 第 2 に、[PPX リライター](https://ocaml.org/docs/metaprogramming)と呼ばれるコンパイル時の OCaml ネイティブ・プログラムで、上記で定義された構文追加を読み込み、拡張または置換を行います。

構文追加には、[Extension nodes](https://v2.ocaml.org/manual/extensionnodes.html)と[attributes](https://v2.ocaml.org/manual/attributes.html)という 2 つの種類があります。

#### Extension nodes

Extension nodes は、extender と呼ばれる特定のタイプの PPX リライターによって置き換えられることになっているブロックです。Extension nodes は、識別のために`%`文字を使用します。extender は Extension nodes を有効な OCaml AST（抽象構文木）に置き換えます。

Melange が拡張ノードを使用して JavaScript とコミュニケーションする例として、Melange プログラム内で「生の」JavaScript を生成する方法があります：

```ocaml
[%%mel.raw "var a = 1; var b = 2"]
let add = [%mel.raw "a + b"]
```

```reasonml
[%%mel.raw "var a = 1; var b = 2"];
let add = [%mel.raw "a + b"];
```

これは、以下のような JavaScript コードを生成します：

```js
var a = 1
var b = 2
var add = a + b
```

パーセント 1 文字と 2 文字の違いについては、[OCaml のドキュメント](https://v2.ocaml.org/manual/extensionnodes.html)を参照してください。

#### Attributes

Attributes は、コードの特定の部分に追加情報を提供するために適用される「装飾」です。Melange では、JavaScript コード生成の表現力を高めるために、既存の OCaml 組み込み Attributes を再利用するか、新しい Attributes を定義するかの 2 つの方法で Attributes を使用します。

##### OCaml attributes の再利用

最初のアプローチは、既存の[OCaml の組み込み attributes](https://v2.ocaml.org/manual/attributes.html#ss:builtin-attributes)を JavaScript の生成に活用することです。

Melange プロジェクトで使用できる OCaml 属性の代表的な例として、`unboxed`属性があります。これは、シングルフィールドのレコードとバリアントを 1 つのタグでコンパイルし、生の値に最適化するものです。これは、混在させたくない型エイリアスを定義する場合や、異種コレクションを使用する JavaScript コードにバインドする場合に便利です。後者の例は [variadic 関数の引数](#variadic-function-arguments)のセクションで説明します。

例えば：

```ocaml
type name =
  | Name of string [@@unboxed]
let student_name = Name "alice"
```

```reasonml
[@unboxed]
type name =
  | Name(string);
let student_name = Name("alice");
```

は、以下のようにコンパイルされます：

```js
var student_name = 'alice'
```

`alert`や`deprecated`のような他の OCaml 組み込み attributes も Melange で使用できます。

##### 新しい attributes を定義する

2 つ目のアプローチは、JavaScript オブジェクトのプロパティにバインドするために使用される[`mel.set`属性](#bind-to-object-properties)のような、Melange のために特別に設計された新しい属性を導入することです。Melange によって導入された属性の完全なリストは、[ここ](#list-of-attributes-and-extension-nodes)にあります。

Attribute アノテーションは、コード内の配置と、どの種類のシンタックス・ツリー・ノードにアノテーションするかによって、1 文字、2 文字、または 3 文字の`@`を使用することができます。アトリビュートの詳細については、[OCaml のマニュアル・ページ](https://v2.ocaml.org/manual/attributes.html)を参照してください。

Melange の attribute である[`mel.set`](#bind-to-object-properties) と [`mel.as`](#using-ocaml-records) を使ったサンプルです：

```ocaml
type document
external setTitleDom : document -> string -> unit = "title" [@@mel.set]

type t = {
  age : int; [@mel.as "a"]
  name : string; [@mel.as "n"]
}
```

```reasonml
type document;
[@mel.set] external setTitleDom: (document, string) => unit = "title";

type t = {
  [@mel.as "a"]
  age: int,
  [@mel.as "n"]
  name: string,
};
```

プリプロセッサ、attributes、Extension nodes の詳細については、[OCaml ドキュメントの PPX リライタのセクション](https://ocaml.org/docs/metaprogramming#ppx-rewriters)を参照してください。

### External 関数

Melange が JavaScript と通信するために公開しているシステムのほとんどは、`external`と呼ばれる OCaml の構成要素の上に構築されています。

`external`は、OCaml で[C コードとのインターフェイス](https://v2.ocaml.org/manual/intfc.html)となる値を宣言するためのキーワードです：

```ocaml
external my_c_function : int -> string = "someCFunctionName"
```

```reasonml
external my_c_function: int => string = "someCFunctionName";
```

これは`let`バインディングのようなものだが、external のボディが文字列である点が異なります。この文字列は文脈によって特定の意味を持つ。ネイティブの OCaml では、通常その名前の C 関数を指します。Melange の場合は、実行時の JavaScript コードに存在し、Melange から使用される関数または値を指します。

Melange では、external を使用してグローバルな JavaScript オブジェクトにバインドすることができます。また、特定の`[@mel.xxx]`属性で装飾することで、特定のシナリオでのバインディングを容易にすることもできます。利用可能な属性については、次のセクションで詳しく説明します。

一度宣言すれば、`external`を通常の値として使用することができます。Melange の external 関数は期待される JavaScript の値に変換され、コンパイル時に呼び出し元にインライン化され、コンパイル後は完全に消去されます。JavaScript の出力には現れないので、バンドルサイズにコストはかかりません。

**Note**: 外部関数と`[@mel.xxx]`属性をインターフェースファイルでも使用することをお勧めします。これにより、結果として得られる JavaScript の値を呼び出し先で直接インライン化することができ、いくつかの最適化が可能になるからです。

#### 特別な identity external

特筆すべき external には次のものがあります：

```ocaml
type foo = string
type bar = int
external danger_zone : foo -> bar = "%identity"
```

```reasonml
type foo = string;
type bar = int;
external danger_zone: foo => bar = "%identity";
```

これは、`foo`型を`bar`型に変換することだけを行う最後の脱出口です。以下のセクションで、もし external 関数を書くのに失敗したら、この関数を使うことに戻ることができますが、そうしないようにしましょう。

### Abstract types

この後のセクションで、値が代入されずに型が定義されているバインディングの例に出会うでしょう。以下はその例です：

```ocaml
type document
```

```reasonml
type document;
```

これらの型は「抽象型」と呼ばれ、JavaScript と通信する際に、値に対する操作を定義する external 関数とともに一般的に使用される。

抽象型は、不要な詳細を省きつつ、JavaScript に由来する特定の値に対する型を定義することを可能にします。例えば、前述の `document` 型はいくつかのプロパティを持ちます。抽象型を使用することで、すべてのプロパティを定義するのではなく、Melange プログラムが必要とするドキュメント値の必要な部分のみに焦点を当てることができます。次の例を考えてみましょう：

```ocaml
type document

external document : document = "document"
external set_title : document -> string -> unit = "title" [@@mel.set]
```

```reasonml
type document;

external document: document = "document";
[@mel.set] external set_title: (document, string) => unit = "title";
```

後続のセクションでは、[`mel.set`](#bind-to-object-properties)属性の詳細と、`document`のような[グローバルな値へのバインディング方法](#using-global-functions-or-values)について掘り下げます。

抽象型とその有用性の包括的な理解については、[OCaml Cornell textbook](https://cs3110.github.io/textbook/chapters/modules/encapsulation.html)の「カプセル化」のセクションを参照してください。

### Pipe operators

Melange には二つの pipe 演算子があります：

- _pipe last_ `|>`: [OCaml でサポート](https://v2.ocaml.org/api/Stdlib.html#1_Compositionoperators)され、Melange にも継承されています
- _pipe first_ `|.`, `->`: Melange 独自のものです

二つの違いについて見ていきましょう

#### Pipe last

バージョン 4.01 以降、OCaml には逆引き演算子または「パイプ」演算子（`|>`）が追加されました。OCaml のバックエンドとして、Melange はこの演算子を継承しています。

パイプ演算子は次のように実装できます（実際の実装は少し[異なります](https://github.com/ocaml/ocaml/blob/d9547617e8b14119beacafaa2546cbebfac1bfe5/stdlib/stdlib.ml#L48)）：

```ocaml
let ( |> ) f g = g f
```

```reasonml
let (|>) = (f, g) => g(f);
```

この演算子は、ある値に対して複数の関数を順番に適用し、各関数の出力が次の関数の入力になる（_パイプライン_）場合に便利です。

例えば、次のように定義された関数`square`があるとします：

```ocaml
let square x = x * x
```

```reasonml
let square = x => x * x;
```

以下のように使用することができます：

```ocaml
let ten = succ (square 3)
```

```reasonml
let ten = succ(square(3));
```

パイプ演算子を使えば、左から右の順に[結合性を保った](https://v2.ocaml.org/manual/expr.html#ss:precedence-and-associativity) `ten`を書くことができます：

```ocaml
let ten = 3 |> square |> succ
```

```reasonml
let ten = 3 |> square |> succ;
```

複数の引数を取ることができる関数を扱う場合、パイプ演算子は、関数が処理中のデータを最後の引数として取るときに最もよく機能します。例えば：

```ocaml
let sum = List.fold_left ( + ) 0

let sum_sq =
  [ 1; 2; 3 ]
  |> List.map square (* [1; 4; 9] *)
  |> sum             (* 1 + 4 + 9 *)
```

```reasonml
let sum = List.fold_left((+), 0);

let sum_sq =
  [1, 2, 3]
  |> List.map(square)  /* [1; 4; 9] */
  |> sum; /* 1 + 4 + 9 */
```

[OCaml 標準ライブラリ](https://v2.ocaml.org/api/Stdlib.List.html)の`List.map`関数は、第 2 引数にリストを取るので、上記の例は簡潔に書くことができます。この規約は「データ・ラスト」と呼ばれることもあり、OCaml のエコシステムでは広く採用されている。データ・ラストとパイプ演算子`|>`は currying と相性が良いので、OCaml 言語にぴったりです。

しかし、エラー処理に関しては、データ・ラストの使用にはいくつかの制限があります。この例では、間違った関数を使ったとします：

```ocaml
let sum_sq =
  [ 1; 2; 3 ]
  |> List.map String.cat
  |> sum
```

```reasonml
let sum_sq =
  [1, 2, 3]
  |> List.map(String.cat)
  |> sum;
```

コンパイラーは当然エラーを出します：

```ocaml
4 |   [ 1; 2; 3 ]
        ^
Error: This expression has type int but an expression was expected of type
         string
```

```reasonml
1 |   [ 1, 2, 3 ]
        ^
Error: This expression has type int but an expression was expected of type
         string
```

`List.map（String.cat）`で間違った関数を渡していることを教えてくれるのではなく、エラーはリストそのものを指していることに注意してください。この動作は、コンパイラーが左から右へと型を推論する、型推論の動作方法と一致しています。`[1; 2; 3 ] |> List.map String.cat`は、`List.map String.cat [ 1; 2; 3 ]`と等価なので、型の不一致は、`String.cat`が処理された後、リストが型チェックされるときに検出されます。

このような制限に対処する目的で、Melange は Pipe first 演算子 `|.`(OCaml) / `->`(Reason)を導入しました。

#### Pipe first

上記の制約を克服するために、Melange は Pipe first 演算子`|.`(OCaml) / `->`(Reason)を導入しました。

その名前が示すように、Pipe first 演算子はデータが第 1 引数として渡される関数に適しています。

Melange に含まれる Belt ライブラリ([OCaml](https://melange.re/v2.2.0/api/ml/melange/Belt), [Reason](https://melange.re/v2.2.0/api/re/melange/Belt))の関数は、Data First の規約を念頭に置いて設計されているため、Pipe first 演算子との組み合わせが最適です。

例えば、上の例を`Belt.List.map`と Pipe first 演算子を使って書き直すことができます：

```ocaml
let sum_sq =
  [ 1; 2; 3 ]
  |. Belt.List.map square
  |. sum
```

```reasonml
let sum_sq =
  [1, 2, 3]
  -> (Belt.List.map(square))
  -> sum;
```

`Belt.List.map`に間違った関数が渡された場合のエラーの違いを見てみましょう：

```ocaml
let sum_sq =
  [ 1; 2; 3 ]
  |. Belt.List.map String.cat
  |. sum
```

```reasonml
let sum_sq = [1, 2, 3]->(Belt.List.map(String.cat))->sum;
```

コンパイラーはこのエラー・メッセージを表示します：

```
4 |   |. Belt.List.map String.cat
                       ^^^^^^^^^^
Error: This expression has type string -> string -> string
       but an expression was expected of type int -> 'a
       Type string is not compatible with type int
```

```
2 | let sum_sq = [1, 2, 3]->(Belt.List.map(String.cat))->sum;
                                           ^^^^^^^^^^
Error: This expression has type string -> string -> string
       but an expression was expected of type int -> 'a
       Type string is not compatible with type int
```

エラーは`Belt.List.map`に渡された関数を指しています。

Melange では、[Chaining](#chaining)のセクションで示したように、データファーストまたはデータラストという 2 つの規約を使用して JavaScript にバインディングを記述することができます。

データファーストとデータラストの演算子の違いと、そのトレードオフについては、[こちらのブログ記事](https://www.javierchavarri.com/data-first-and-data-last-a-comparison/)を参照してください。

## データ型とランタイム表現

Melange の各型は以下のように JavaScript の値に変換されます：
| Melange | JavaScript |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| int | number |
| nativeint | number |
| int32 | number |
| float | number |
| string | string |
| array | array |
| tuple `(3, 4)` | array `[3, 4]` |
| bool | boolean |
| [Js.Nullable.t]([OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Nullable) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Nullable)) | `null` / `undefined` |
| Js.Re.t([OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Re) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Re)) | [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) |
| Option.t `None` | `undefined` |
| Option.t `Some( Some .. Some (None))`(OCaml), `Some(Some( .. Some(None)))`(Reason) | internal representation |
| Option.t `Some 2`(OCaml), `Some(2)`(Reason) | `2` |
| record `{x = 1; y = 2}`(OCaml) / `{x: 1; y: 2}`(Reason) | object `{x: 1, y: 2}` |
| int64 | array of 2 elements `[high, low]` high is signed, low unsigned |
| char | `'a'` -\> `97` (ascii code) |
| bytes | number array |
| list `[]` | `0` |
| list `[ x; y ]`(OCaml) / `[x, y]`(Reason) | `{ hd: x, tl: { hd: y, tl: 0 } }` |
| variant | 以下を参照 |
| polymorphic variant | 以下を参照 |

単一の非 null コンストラクタを持つバリアント：

```ocaml
type tree = Leaf | Node of int * tree * tree
(* Leaf -> 0 *)
(* Node(7, Leaf, Leaf) -> { _0: 7, _1: 0, _2: 0 } *)
```

```reasonml
type tree =
  | Leaf
  | Node(int, tree, tree);
/* Leaf -> 0 */
/* Node(7, Leaf, Leaf) -> { _0: 7, _1: 0, _2: 0 } */
```

複数の非 null コンストラクタを持つバリアント：

```ocaml
type t = A of string | B of int
(* A("foo") -> { TAG: 0, _0: "Foo" } *)
(* B(2) -> { TAG: 1, _0: 2 } *)
```

```reasonml
type t =
  | A(string)
  | B(int);
/* A("foo") -> { TAG: 0, _0: "Foo" } */
/* B(2) -> { TAG: 1, _0: 2 } */
```

Polymorphic variants:

```ocaml
let u = `Foo (* "Foo" *)
let v = `Foo(2) (* { NAME: "Foo", VAL: "2" } *)
```

```reasonml
let u = `Foo; /* "Foo" */
let v = `Foo(2); /* { NAME: "Foo", VAL: "2" } */
```

それでは、これらの型のいくつかを詳しく見ていきましょう。まず、JavaScript の値として透過的に表現される[共有型](#shared-types)について説明し、次に、より複雑な実行時表現を持つ[非共有型](#non-shared-data-types)について説明します。

> **_NOTE:_** Melange コードと通信する JavaScript コードから非共有データ型の実行時表現を手動で読み書きすることで、これらの表現が将来変更される可能性があるため、実行時エラーにつながる可能性があります。

### Shared types

The following are types that can be shared between Melange and JavaScript almost
"as is". Specific caveats are mentioned on the sections where they apply.

#### Strings

JavaScript strings are immutable sequences of UTF-16 encoded Unicode text. OCaml
strings are immutable sequences of bytes and nowadays assumed to be UTF-8
encoded text when interpreted as textual content. This is problematic when
interacting with JavaScript code, because if one tries to use some unicode
characters, like:

```ocaml
let () = Js.log "你好"
```

```reasonml
let () = Js.log("你好");
```

It will lead to some cryptic console output. To rectify this, Melange allows to
define [quoted string
literals](https://v2.ocaml.org/manual/lex.html#sss:stringliterals) using the
`js` identifier, for example:

```ocaml
let () = Js.log {js|你好，
世界|js}
```

```reasonml
let () = Js.log({js|你好，
世界|js});
```

For convenience, Melange exposes another special quoted string identifier: `j`.
It is similar to JavaScript’ string interpolation, but for variables only (not
arbitrary expressions):

```ocaml
let world = {j|世界|j}
let helloWorld = {j|你好，$world|j}
```

```reasonml
let world = {j|世界|j};
let helloWorld = {j|你好，$world|j};
```

You can surround the interpolation variable in parentheses too: `{j|你
好，$(world)|j}`.

To work with strings, the Melange standard library provides some utilities in
the <a class="text-ocaml"
href="../api/ml/melange/Stdlib/String"><code>Stdlib.String</code> module</a><a
class="text-reasonml"
href="../api/re/melange/Stdlib/String"><code>Stdlib.String</code> module</a>.
The bindings to the native JavaScript functions to work with strings are in the
<a class="text-ocaml" href="../api/ml/melange/Js/String"><code>Js.String</code>
module</a><a class="text-reasonml"
href="../api/re/melange/Js/String"><code>Js.String</code> module</a>.

#### Floating-point numbers

OCaml floats are [IEEE
754](https://en.wikipedia.org/wiki/Double-precision_floating-point_format#IEEE_754_double-precision_binary_floating-point_format:_binary64)
with a 53-bit mantissa and exponents from -1022 to 1023. This happens to be the
same encoding as [JavaScript
numbers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_encoding),
so values of these types can be used transparently between Melange code and
JavaScript code. The Melange standard library provides a <a class="text-ocaml"
href="../api/ml/melange/Stdlib/Float"><code>Stdlib.Float</code> module</a><a
class="text-reasonml"
href="../api/re/melange/Stdlib/Float"><code>Stdlib.Float</code> module</a>. The
bindings to the JavaScript APIs that manipulate float values can be found in the
<a class="text-ocaml" href="../api/ml/melange/Js/Float"><code>Js.Float</code>
module</a><a class="text-reasonml"
href="../api/re/melange/Js/Float"><code>Js.Float</code> module</a>.

#### Integers

In Melange, integers are limited to 32 bits due to the [fixed-width
conversion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#fixed-width_number_conversion)
of bitwise operations in JavaScript. While Melange integers compile to
JavaScript numbers, treating them interchangeably can result in unexpected
behavior due to differences in precision. Even though bitwise operations in
JavaScript are constrained to 32 bits, integers themselves are represented using
the same floating-point format [as
numbers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_encoding),
allowing for a larger range of representable integers in JavaScript compared to
Melange. When dealing with large numbers, it is advisable to use floats instead.
For instance, floats are used in bindings like `Js.Date`.

The Melange standard library provides a <a class="text-ocaml"
href="../api/ml/melange/Stdlib/Int"><code>Stdlib.Int</code> module</a><a
class="text-reasonml"
href="../api/re/melange/Stdlib/Int"><code>Stdlib.Int</code> module</a>. The
bindings to work with JavaScript integers are in the <a class="text-ocaml"
href="../api/ml/melange/Js/Int"><code>Js.Int</code> module</a><a
class="text-reasonml" href="../api/re/melange/Js/Int"><code>Js.Int</code>
module</a>.

#### Arrays

Melange arrays compile to JavaScript arrays. But note that unlike JavaScript
arrays, all the values in a Melange array need to have the same type.

Another difference is that OCaml arrays are fixed-sized, but on Melange side
this constraint is relaxed. You can change an array’s length using functions
like `Js.Array.push`, available in the bindings to the JavaScript APIs in the <a
class="text-ocaml" href="../api/ml/melange/Js/Array"><code>Js.Array</code>
module</a><a class="text-reasonml"
href="../api/re/melange/Js/Array"><code>Js.Array</code> module</a>.

Melange standard library also has a module to work with arrays, available in the
<a class="text-ocaml"
href="../api/ml/melange/Stdlib/Array"><code>Stdlib.Array</code> module</a><a
class="text-reasonml"
href="../api/re/melange/Stdlib/Array"><code>Stdlib.Array</code> module</a>.

#### Tuples

OCaml tuples are compiled to JavaScript arrays. This is convenient when writing
bindings that will use a JavaScript array with heterogeneous values, but that
happens to have a fixed length.

As a real world example of this can be found in
[ReasonReact](https://github.com/reasonml/reason-react/), the Melange bindings
for [React](https://react.dev/). In these bindings, component effects
dependencies are represented as OCaml tuples, so they get compiled cleanly to
JavaScript arrays by Melange.

For example, some code like this:

```ocaml
let () = React.useEffect2 (fun () -> None) (foo, bar)
```

```reasonml
let () = React.useEffect2(() => None, (foo, bar));
```

Will produce:

```javascript
React.useEffect(function () {}, [foo, bar])
```

#### Booleans

Values of type `bool` compile to JavaScript booleans.

#### Records

Melange records map directly to JavaScript objects. If the record fields include
non-shared data types (like variants), these values should be transformed
separately, and not be directly used in JavaScript.

Extensive documentation about interfacing with JavaScript objects using records
can be found in [the section below](#bind-to-js-object).

#### Regular expressions

Regular expressions created using the `%mel.re` extension node compile to their
JavaScript counterpart.

For example:

```ocaml
let r = [%mel.re "/b/g"]
```

```reasonml
let r = [%mel.re "/b/g"];
```

Will compile to:

```js
var r = /b/g
```

A regular expression like the above is of type `Js.Re.t`. The <a
class="text-ocaml" href="../api/ml/melange/Js/Re"><code>Js.Re</code>
module</a><a class="text-reasonml"
href="../api/re/melange/Js/Re"><code>Js.Re</code> module</a> provides the
bindings to the JavaScript functions that operate over regular expressions.

## Non-shared data types

The following types differ too much between Melange and JavaScript, so while
they can always be manipulated from JavaScript, it is recommended to transform
them before doing so.

- Variants and polymorphic variants: Better transform them into readable
  JavaScript values before manipulating them from JavaScript, Melange provides
  [some helpers](#generate-getters-setters-and-constructors) to do so.
- Exceptions
- Option (a variant type): Better use the `Js.Nullable.fromOption` and
  `Js.Nullable.toOption` functions in the <a class="text-ocaml"
  href="../api/ml/melange/Js/Nullable"><code>Js.Nullable</code> module</a><a
  class="text-reasonml"
  href="../api/re/melange/Js/Nullable"><code>Js.Nullable</code> module</a> to
  transform them into either `null` or `undefined` values.
- List (also a variant type): use `Array.of_list` and `Array.to_list` in the <a
  class="text-ocaml"
  href="../api/ml/melange/Stdlib/Array"><code>Stdlib.Array</code> module</a><a
  class="text-reasonml"
  href="../api/re/melange/Stdlib/Array"><code>Stdlib.Array</code> module</a>.
- Character
- Int64
- Lazy values

## List of attributes and extension nodes

**Attributes:**

These attributes are used to annotate `external` definitions:

- [`mel.get`](#bind-to-object-properties): read JavaScript object properties
  statically by name, using the dot notation `.`
- [`mel.get_index`](#bind-to-object-properties): read a JavaScript object’s
  properties dynamically by using the bracket notation `[]`
- [`mel.module`](#using-functions-from-other-javascript-modules): bind to a
  value from a JavaScript module
- [`mel.new`](#javascript-classes): bind to a JavaScript class constructor
- [`mel.obj`](#using-external-functions): create a JavaScript object
- [`mel.return`](#wrapping-returned-nullable-values): automate conversion from
  nullable values to `Option.t` values
- [`mel.send`](#calling-an-object-method): call a JavaScript object method using
  [pipe first](#pipe-first) convention
- [`mel.send.pipe`](#calling-an-object-method): call a JavaScript object method
  using [pipe last](#pipe-last) convention
- [`mel.set`](#bind-to-object-properties): set JavaScript object properties
  statically by name, using the dot notation `.`
- [`mel.set_index`](#bind-to-object-properties): set JavaScript object
  properties dynamically by using the bracket notation `[]`
- [`mel.scope`](#binding-to-properties-inside-a-module-or-global): reach to
  deeper properties inside a JavaScript object
- [`mel.splice`](#variadic-function-arguments): a deprecated attribute, is an
  alternate form of `mel.variadic`
- [`mel.variadic`](#variadic-function-arguments): bind to a function taking
  variadic arguments from an array

These attributes are used to annotate arguments in `external` definitions:

- [`u`](#binding-to-callbacks): define function arguments as uncurried (manual)
- [`mel.int`](#using-polymorphic-variants-to-bind-to-enums): compile function
  argument to an int
- [`mel.string`](#using-polymorphic-variants-to-bind-to-enums): compile function
  argument to a string
- [`mel.this`](#modeling-this-based-callbacks): bind to `this` based callbacks
- [`mel.uncurry`](#binding-to-callbacks): define function arguments as uncurried
  (automated)
- [`mel.unwrap`](#approach-2-polymorphic-variant-bsunwrap): unwrap variant
  values

These attributes are used in places like records, fields, arguments, functions,
and more:

- `mel.as`: redefine the name generated in the JavaScript output code. Used in
  [constant function arguments](#constant-values-as-arguments),
  [variants](#conversion-functions), polymorphic variants (either [inlined in
  external functions](#using-polymorphic-variants-to-bind-to-enums) or [in type
  definitions](#polymorphic-variants)) and [record
  fields](#objects-with-static-shape-record-like).
- [`deriving`](#generate-getters-setters-and-constructors): generate getters and
  setters for some types
- [`mel.inline`](#inlining-constant-values): forcefully inline constant values
- [`optional`](#generate-javascript-objects-with-optional-properties):
  translates optional fields in a record to omitted properties in the generated
  JavaScript object (combines with `deriving`)

**Extension nodes:**

In order to use any of these extension nodes, you will have to add the melange
PPX preprocessor to your project. To do so, add the following to the `dune`
file:

```text
(library
 (name lib)
 (modes melange)
 (preprocess
   (pps melange.ppx)))
```

The same field `preprocess` can be added to `melange.emit`.

Here is the list of all the extension nodes supported by Melange:

- [`mel.debugger`](#debugger): insert `debugger` statements
- [`mel.external`](#detect-global-variables): read global values
- [`mel.obj`](#using-jst-objects): create JavaScript object literals
- [`mel.raw`](#generate-raw-javascript): write raw JavaScript code
- [`mel.re`](#regular-expressions): insert regular expressions

## Generate raw JavaScript

It is possible to directly write JavaScript code from a Melange file. This is
unsafe, but it can be useful for prototyping or as an escape hatch.

To do it, we will use the `mel.raw`
[extension](https://v2.ocaml.org/manual/extensionnodes.html):

```ocaml
let add = [%mel.raw {|
  function(a, b) {
    console.log("hello from raw JavaScript!");
    return a + b;
  }
|}]

let () = Js.log (add 1 2)
```

```reasonml
let add = [%mel.raw
  {|
  function(a, b) {
    console.log("hello from raw JavaScript!");
    return a + b;
  }
|}
];

let () = Js.log(add(1, 2));
```

The `{||}` strings are called ["quoted
strings"](https://ocaml.org/manual/lex.html#quoted-string-id). They are similar
to JavaScript’s template literals, in the sense that they are multi-line, and
there is no need to escape characters inside the string.

Using <span class="text-ocaml">one percentage sign</span><span
class="text-reasonml">the extension name between square brackets</span>
(`[%mel.raw <string>]`) is useful to define expressions (function bodies, or
other values) where the implementation is directly JavaScript. This is useful as
we can attach the type signature already in the same line, to make our code
safer. For example:

```ocaml
let f : unit -> int = [%mel.raw "function() {return 1}"]
```

```reasonml
let f: unit => int = ([%mel.raw "function() {return 1}"]: unit => int);
```

Using <span class="text-ocaml">two percentage signs (`[%%mel.raw
<string>]`)</span><span class="text-reasonml">the extension name without square
brackets (`%mel.raw <string>`)</span> is reserved for definitions in a
[structure](https://v2.ocaml.org/manual/moduleexamples.html#s:module:structures)
or [signature](https://v2.ocaml.org/manual/moduleexamples.html#s%3Asignature).

For example:

```ocaml
[%%mel.raw "var a = 1"]
```

```reasonml
[%%mel.raw "var a = 1"];
```

## Debugger

Melange allows you to inject a `debugger;` expression using the `mel.debugger`
extension:

```ocaml
let f x y =
  [%mel.debugger];
  x + y
```

```reasonml
let f = (x, y) => {
  [%mel.debugger];
  x + y;
};
```

Output:

```javascript
function f(x, y) {
  debugger // JavaScript developer tools will set a breakpoint and stop here
  return (x + y) | 0
}
```

## Detect global variables

Melange provides a relatively type safe approach to use globals that might be
defined either in the JavaScript runtime environment: `mel.external`.

`[%mel.external id]` will check if the JavaScript value `id` is `undefined` or
not, and return an `Option.t` value accordingly.

For example:

```ocaml
let () = match [%mel.external __DEV__] with
| Some _ -> Js.log "dev mode"
| None -> Js.log "production mode"
```

```reasonml
let () =
  switch ([%mel.external __DEV__]) {
  | Some(_) => Js.log("dev mode")
  | None => Js.log("production mode")
  };
```

Another example:

```ocaml
let () = match [%mel.external __filename] with
| Some f -> Js.log f
| None -> Js.log "non-node environment"
```

```reasonml
let () =
  switch ([%mel.external __filename]) {
  | Some(f) => Js.log(f)
  | None => Js.log("non-node environment")
  };
```

## Inlining constant values

Some JavaScript idioms require special constants to be inlined since they serve
as de-facto directives for bundlers. A common example is `process.env.NODE_ENV`:

```js
if (process.env.NODE_ENV !== 'production') {
  // Development-only code
}
```

becomes:

```js
if ('development' !== 'production') {
  // Development-only code
}
```

In this case, bundlers such as Webpack can tell that the `if` statement always
evaluates to a specific branch and eliminate the others.

Melange provides the `mel.inline` attribute to achieve the same goal in
generated JavaScript. Let’s look at an example:

```ocaml
external node_env : string = "NODE_ENV" [@@mel.scope "process", "env"]

let development = "development"
let () = if node_env <> development then Js.log "Only in Production"

let development_inline = "development" [@@mel.inline]
let () = if node_env <> development_inline then Js.log "Only in Production"
```

```reasonml
[@mel.scope ("process", "env")] external node_env: string = "NODE_ENV";

let development = "development";
let () =
  if (node_env != development) {
    Js.log("Only in Production");
  };

[@mel.inline]
let development_inline = "development";
let () =
  if (node_env != development_inline) {
    Js.log("Only in Production");
  };
```

As we can see in the generated JavaScript presented below:

- the `development` variable is emitted
  - it gets used as a variable `process.env.NODE_ENV !== development` in the
    `if` statement
- the `development_inline` variable isn’t present in the final output
  - its value is inlined in the `if` statement: `process.env.NODE_ENV !==
"development"`

```js
var development = 'development'

if (process.env.NODE_ENV !== development) {
  console.log('Only in Production')
}

if (process.env.NODE_ENV !== 'development') {
  console.log('Only in Production')
}
```

## Bind to JavaScript objects

JavaScript objects are used in a variety of use cases:

- As a fixed shape
  [record](<https://en.wikipedia.org/wiki/Record_(computer_science)>).
- As a map or dictionary.
- As a class.
- As a module to import/export.

Melange separates the binding methods for JavaScript objects based on these four
use cases. This section documents the first three. Binding to JavaScript module
objects is described in the ["Using functions from other JavaScript
modules"](#using-functions-from-other-javascript-modules) section.

<!-- TODO: mention scope here too? -->

### Objects with static shape (record-like)

#### Using OCaml records

If your JavaScript object has fixed fields, then it’s conceptually like an
[OCaml
record](https://v2.ocaml.org/manual/coreexamples.html#s%3Atut-recvariants).
Since Melange compiles records into JavaScript objects, the most common way to
bind to JavaScript objects is using records.

```ocaml
type person = {
  name : string;
  friends : string array;
  age : int;
}

external john : person = "john" [@@mel.module "MySchool"]
let john_name = john.name
```

```reasonml
type person = {
  name: string,
  friends: array(string),
  age: int,
};

[@mel.module "MySchool"] external john: person = "john";
let john_name = john.name;
```

This is the generated JavaScript:

```js
var MySchool = require('MySchool')

var john_name = MySchool.john.name
```

External functions are documented in [a previous section](#external-functions).
The `mel.module` attribute is documented
[here](#using-functions-from-other-javascript-modules).

If you want or need to use different field names on the Melange and the
JavaScript sides, you can use the `mel.as` decorator:

```ocaml
type action = {
  type_ : string [@mel.as "type"]
}

let action = { type_ = "ADD_USER" }
```

```reasonml
type action = {
  [@mel.as "type"]
  type_: string,
};

let action = {type_: "ADD_USER"};
```

Which generates the JavaScript code:

```js
var action = {
  type: 'ADD_USER',
}
```

This is useful to map to JavaScript attribute names that cannot be expressed in
Melange, for example, where the JavaScript name we want to generate is a
[reserved keyword](https://v2.ocaml.org/manual/lex.html#sss:keywords).

It is also possible to map a Melange record to a JavaScript array by passing
indices to the `mel.as` decorator:

```ocaml
type t = {
  foo : int; [@mel.as "0"]
  bar : string; [@mel.as "1"]
}

let value = { foo = 7; bar = "baz" }
```

```reasonml
type t = {
  [@mel.as "0"]
  foo: int,
  [@mel.as "1"]
  bar: string,
};

let value = {foo: 7, bar: "baz"};
```

And its JavaScript generated code:

```js
var value = [7, 'baz']
```

#### Using `Js.t` objects

Alternatively to records, Melange offers another type that can be used to
produce JavaScript objects. This type is `'a Js.t`, where `'a` is an [OCaml
object](https://v2.ocaml.org/manual/objectexamples.html).

The advantage of objects versus records is that no type declaration is needed in
advance, which can be helpful for prototyping or quickly generating JavaScript
object literals.

Melange provides some ways to create `Js.t` object values, as well as accessing
the properties inside them. To create values, the `[%mel.obj]` extension is
used, and the `##` infix operator allows to read from the object properties:

```ocaml
let john = [%mel.obj { name = "john"; age = 99 }]
let t = john##name
```

```reasonml
let john = {"name": "john", "age": 99};
let t = john##name;
```

Which generates:

```js
var john = {
  name: 'john',
  age: 99,
}

var t = john.name
```

Note that object types allow for some flexibility that the record types do not
have. For example, an object type can be coerced to another with fewer values or
methods, while it is impossible to coerce a record type to another one with
fewer fields. So different object types that share some methods can be mixed in
a data structure where only their common methods are visible.

To give an example, one can create a function that operates in all the object
types that include a field `name` that is of type string, e.g.:

```ocaml
let name_extended obj = obj##name ^ " wayne"

let one = name_extended [%mel.obj { name = "john"; age = 99 }]
let two = name_extended [%mel.obj { name = "jane"; address = "1 infinite loop" }]
```

```reasonml
let name_extended = obj => obj##name ++ " wayne";

let one = name_extended({"name": "john", "age": 99});
let two = name_extended({"name": "jane", "address": "1 infinite loop"});
```

To read more about objects and polymorphism we recommend checking the [OCaml
docs](https://ocaml.org/docs/objects) or the [OCaml
manual](https://v2.ocaml.org/manual/objectexamples.html).

#### Using external functions

We have already explored one approach for creating JavaScript object literals by
using [`Js.t` values and the `mel.obj` extension](#using-jst-objects).

Melange additionally offers the `mel.obj` attribute, which can be used in
combination with external functions to create JavaScript objects. When these
functions are called, they generate objects with fields corresponding to the
labeled arguments of the function.

If any of these labeled arguments are defined as optional and omitted during
function application, the resulting JavaScript object will exclude the
corresponding fields. This allows to create runtime objects and control whether
optional keys are emitted at runtime.

For example, assuming we need to bind to a JavaScript object like this:

```js
var homeRoute = {
  type: 'GET',
  path: '/',
  action: () => console.log('Home'),
  // options: ...
}
```

The first three fields are required and the `options` field is optional. You can
declare a binding function like:

```ocaml
external route :
  _type:string ->
  path:string ->
  action:(string list -> unit) ->
  ?options:< .. > ->
  unit ->
  _ = ""
  [@@mel.obj]
```

```reasonml
[@mel.obj]
external route:
  (
    ~_type: string,
    ~path: string,
    ~action: list(string) => unit,
    ~options: {..}=?,
    unit
  ) =>
  _;
```

Note that the empty string at the end of the function is used to make it
syntactically valid. The value of this string is ignored by the compiler.

Since there is an optional argument `options`, an additional unlabeled argument
of type `unit` is included after it. It allows to omit the optional argument on
function application. More information about labeled optional arguments can be
found in the [OCaml
manual](https://v2.ocaml.org/manual/lablexamples.html#s:optional-arguments).

The return type of the function should be left unspecified using the wildcard
type `_`. Melange will automatically infer the type of the resulting JavaScript
object.

In the route function, the `_type` argument starts with an underscore. When
binding to JavaScript objects with fields that are reserved keywords in OCaml,
Melange allows the use of an underscore prefix for the labeled arguments. The
resulting JavaScript object will have the underscore removed from the field
names. This is only required for the `mel.obj` attribute, while for other cases,
the `mel.as` attribute can be used to rename fields.

If we call the function like this:

```ocaml
let homeRoute = route ~_type:"GET" ~path:"/" ~action:(fun _ -> Js.log "Home") ()
```

```reasonml
let homeRoute =
  route(~_type="GET", ~path="/", ~action=_ => Js.log("Home"), ());
```

We get the following JavaScript, which does not include the `options` field
since its argument wasn’t present:

```javascript
var homeRoute = {
  type: 'GET',
  path: '/',
  action: function (param) {
    console.log('Home')
  },
}
```

#### Bind to object properties

If you need to bind only to the property of a JavaScript object, you can use
`mel.get` and `mel.set` to access it using the dot notation `.`:

```ocaml
(* Abstract type for the `document` value *)
type document

external document : document = "document"

external set_title : document -> string -> unit = "title" [@@mel.set]
external get_title : document -> string = "title" [@@mel.get]

let current = get_title document
let () = set_title document "melange"
```

```reasonml
/* Abstract type for the `document` value */
type document;

external document: document = "document";

[@mel.set] external set_title: (document, string) => unit = "title";
[@mel.get] external get_title: document => string = "title";

let current = get_title(document);
let () = set_title(document, "melange");
```

This generates:

```javascript
var current = document.title
document.title = 'melange'
```

Alternatively, if some dynamism is required on the way the property is accessed,
you can use `mel.get_index` and `mel.set_index` to access it using the bracket
notation `[]`:

```ocaml
type t
external create : int -> t = "Int32Array" [@@mel.new]
external get : t -> int -> int = "" [@@mel.get_index]
external set : t -> int -> int -> unit = "" [@@mel.set_index]

let () =
  let i32arr = (create 3) in
  set i32arr 0 42;
  Js.log (get i32arr 0)
```

```reasonml
type t;
[@mel.new] external create: int => t = "Int32Array";
[@mel.get_index] external get: (t, int) => int;
[@mel.set_index] external set: (t, int, int) => unit;

let () = {
  let i32arr = create(3);
  set(i32arr, 0, 42);
  Js.log(get(i32arr, 0));
};
```

Which generates:

```js
var i32arr = new Int32Array(3)
i32arr[0] = 42
console.log(i32arr[0])
```

### Objects with dynamic shape (dictionary-like)

Sometimes JavaScript objects are used as dictionaries. In these cases:

- All values stored in the object belong to the same type
- Key-value pairs can be added or removed at runtime

For this particular use case of JavaScript objects, Melange exposes a specific
type `Js.Dict.t`. The values and functions to work with values of this type are
defined in the <a class="text-ocaml"
href="../api/ml/melange/Js/Dict"><code>Js.Dict</code> module</a><a
class="text-reasonml" href="../api/re/melange/Js/Dict"><code>Js.Dict</code>
module</a>, with operations like `get`, `set`, etc.

Values of the type `Js.Dict.t` compile to JavaScript objects.

### JavaScript classes

JavaScript classes are special kinds of objects. To interact with classes,
Melange exposes `mel.new` to emulate e.g. `new Date()`:

```ocaml
type t
external create_date : unit -> t = "Date" [@@mel.new]
let date = create_date ()
```

```reasonml
type t;
[@mel.new] external create_date: unit => t = "Date";
let date = create_date();
```

Which generates:

```js
var date = new Date()
```

You can chain `mel.new` and `mel.module` if the JavaScript class you want to
work with is in a separate JavaScript module:

```ocaml
type t
external book : unit -> t = "Book" [@@mel.new] [@@mel.module]
let myBook = book ()
```

```reasonml
type t;
[@mel.new] [@mel.module] external book: unit => t = "Book";
let myBook = book();
```

Which generates:

```js
var Book = require('Book')
var myBook = new Book()
```

## Bind to JavaScript functions or values

### Using global functions or values

Binding to a JavaScript function available globally makes use of `external`,
like with objects. But unlike objects, there is no need to add any attributes:

```ocaml
(* Abstract type for `timeoutId` *)
type timeoutId
external setTimeout : (unit -> unit) -> int -> timeoutId = "setTimeout"
external clearTimeout : timeoutId -> unit = "clearTimeout"

let id = setTimeout (fun () -> Js.log "hello") 100
let () = clearTimeout id
```

```reasonml
/* Abstract type for `timeoutId` */
type timeoutId;
external setTimeout: (unit => unit, int) => timeoutId = "setTimeout";
external clearTimeout: timeoutId => unit = "clearTimeout";

let id = setTimeout(() => Js.log("hello"), 100);
let () = clearTimeout(id);
```

> **_NOTE:_** The bindings to `setTimeout` and `clearTimeout` are shown here for
> learning purposes, but they are already available in the <a class="text-ocaml"
> href="../api/ml/melange/Js/Global"><code>Js.Global</code> module</a><a
> class="text-reasonml"
> href="../api/re/melange/Js/Global"><code>Js.Global</code> module</a>.

Generates:

```javascript
var id = setTimeout(function (param) {
  console.log('hello')
}, 100)

clearTimeout(id)
```

Global bindings can also be applied to values:

```ocaml
(* Abstract type for `document` *)
type document

external document : document = "document"
let document = document
```

```reasonml
/* Abstract type for `document` */
type document;

external document: document = "document";
let document = document;
```

Which generates:

```javascript
var doc = document
```

### Using functions from other JavaScript modules

`mel.module` allows to bind to values that belong to another JavaScript module.
It accepts a string with the name of the module, or the relative path to it.

```ocaml
external dirname : string -> string = "dirname" [@@mel.module "path"]
let root = dirname "/User/github"
```

```reasonml
[@mel.module "path"] external dirname: string => string = "dirname";
let root = dirname("/User/github");
```

Generates:

```js
var Path = require('path')
var root = Path.dirname('/User/github')
```

### Binding to properties inside a module or global

For cases when we need to create bindings for a property within a module or a
global JavaScript object, Melange provides the `mel.scope` attribute.

For example, if we want to write some bindings for a specific property
`commands` from [the `vscode`
package](https://code.visualstudio.com/api/references/vscode-api#commands), we
can do:

```ocaml
type param
external executeCommands : string -> param array -> unit = ""
  [@@mel.scope "commands"] [@@mel.module "vscode"] [@@mel.variadic]

let f a b c = executeCommands "hi" [| a; b; c |]
```

```reasonml
type param;
[@mel.scope "commands"] [@mel.module "vscode"] [@mel.variadic]
external executeCommands: (string, array(param)) => unit;

let f = (a, b, c) => executeCommands("hi", [|a, b, c|]);
```

Which compiles to:

```javascript
var Vscode = require('vscode')

function f(a, b, c) {
  Vscode.commands.executeCommands('hi', a, b, c)
}
```

The `mel.scope` attribute can take multiple arguments as payload, in case we
want to reach deeper into the object from the module we are importing.

For example:

```ocaml
type t

external back : t = "back"
  [@@mel.module "expo-camera"] [@@mel.scope "Camera", "Constants", "Type"]

let camera_type_back = back
```

```reasonml
type t;

[@mel.module "expo-camera"] [@mel.scope ("Camera", "Constants", "Type")]
external back: t = "back";

let camera_type_back = back;
```

Which generates:

```javascript
var ExpoCamera = require('expo-camera')

var camera_type_back = ExpoCamera.Camera.Constants.Type.back
```

It can be used without `mel.module`, to created scoped bindings to global
values:

```ocaml
external imul : int -> int -> int = "imul" [@@mel.scope "Math"]

let res = imul 1 2
```

```reasonml
[@mel.scope "Math"] external imul: (int, int) => int = "imul";

let res = imul(1, 2);
```

Which produces:

```javascript
var res = Math.imul(1, 2)
```

Or it can be used together with `mel.new`:

```ocaml
type t

external create : unit -> t = "GUI"
  [@@mel.new] [@@mel.scope "default"] [@@mel.module "dat.gui"]

let gui = create ()
```

```reasonml
type t;

[@mel.new] [@mel.scope "default"] [@mel.module "dat.gui"]
external create: unit => t = "GUI";

let gui = create();
```

Which generates:

```javascript
var DatGui = require('dat.gui')

var gui = new DatGui.default.GUI()
```

### Labeled arguments

OCaml has [labeled arguments](https://v2.ocaml.org/manual/lablexamples.html),
which can also be optional, and work with `external` as well.

Labeled arguments can be useful to provide more information about the arguments
of a JavaScript function that is called from Melange.

Let’s say we have the following JavaScript function, that we want to call from
Melange:

```js
// MyGame.js

function draw(x, y, border) {
  // let’s assume `border` is optional and defaults to false
}
draw(10, 20)
draw(20, 20, true)
```

When writing Melange bindings, we can add labeled arguments to make things more
clear:

```ocaml
external draw : x:int -> y:int -> ?border:bool -> unit -> unit = "draw"
  [@@mel.module "MyGame"]

let () = draw ~x:10 ~y:20 ~border:true ()
let () = draw ~x:10 ~y:20 ()
```

```reasonml
[@mel.module "MyGame"]
external draw: (~x: int, ~y: int, ~border: bool=?, unit) => unit = "draw";

let () = draw(~x=10, ~y=20, ~border=true, ());
let () = draw(~x=10, ~y=20, ());
```

Generates:

```js
var MyGame = require('MyGame')

MyGame.draw(10, 20, true)
MyGame.draw(10, 20, undefined)
```

The generated JavaScript function is the same, but now the usage in Melange is
much clearer.

**Note**: in this particular case, a final param of type unit, `()` must be
added after `border`, since `border` is an optional argument at the last
position. Not having the last param `unit` would lead to a warning, which is
explained in detail [in the OCaml
documentation](https://ocaml.org/docs/labels#warning-this-optional-argument-cannot-be-erased).

Note that you can freely reorder the labeled arguments when applying the
function on the Melange side. The generated code will maintain the original
order that was used when declaring the function:

```ocaml
external draw : x:int -> y:int -> ?border:bool -> unit -> unit = "draw"
  [@@mel.module "MyGame"]
let () = draw ~x:10 ~y:20 ()
let () = draw ~y:20 ~x:10 ()
```

```reasonml
[@mel.module "MyGame"]
external draw: (~x: int, ~y: int, ~border: bool=?, unit) => unit = "draw";
let () = draw(~x=10, ~y=20, ());
let () = draw(~y=20, ~x=10, ());
```

Generates:

```js
var MyGame = require('MyGame')

MyGame.draw(10, 20, undefined)
MyGame.draw(10, 20, undefined)
```

### Calling an object method

If we need to call a JavaScript method, Melange provides the attribute
`mel.send`.

> In the following snippets, we will be referring to a type `Dom.element`, which
> is provided within the library `melange.dom`. You can add it to your project
> by including `(libraries melange.dom)` to your `dune` file:

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
external get_by_id : document -> string -> Dom.element = "getElementById"
  [@@mel.send]

let el = get_by_id document "my-id"
```

```reasonml
/* Abstract type for the `document` global */
type document;

external document: document = "document";
[@mel.send]
external get_by_id: (document, string) => Dom.element = "getElementById";

let el = get_by_id(document, "my-id");
```

Generates:

```js
var el = document.getElementById('my-id')
```

When using `mel.send`, the first argument will be the object that holds the
property with the function we want to call. This combines well with the pipe
first operator <code class="text-ocaml">\|.</code><code
class="text-reasonml">\-\></code>, see the ["Chaining"](#chaining) section
below.

If we want to design our bindings to be used with OCaml pipe last operator `|>`,
there is an alternate `mel.send.pipe` attribute. Let’s rewrite the example above
using it:

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
external get_by_id : string -> Dom.element = "getElementById"
  [@@mel.send.pipe: document]

let el = get_by_id "my-id" document
```

```reasonml
/* Abstract type for the `document` global */
type document;

external document: document = "document";
[@mel.send.pipe: document]
external get_by_id: string => Dom.element = "getElementById";

let el = get_by_id("my-id", document);
```

Generates the same code as `mel.send`:

```js
var el = document.getElementById('my-id')
```

#### Chaining

It is common to find this kind of API in JavaScript: `foo().bar().baz()`. This
kind of API can be designed with Melange externals. Depending on which
convention we want to use, there are two attributes available:

- For a data-first convention, the `mel.send` attribute, in combination with
  [the pipe first operator](#pipe-first) <code
  class="text-ocaml">\|.</code><code class="text-reasonml">\-\></code>
- For a data-last convention, the `mel.send.pipe` attribute, in combination with
  OCaml [pipe last operator](#pipe-last) `|>`.

Let’s see first an example of chaining using data-first convention with the pipe
first operator <code class="text-ocaml">\|.</code><code
class="text-reasonml">\-\></code>:

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
external get_by_id : document -> string -> Dom.element = "getElementById"
  [@@mel.send]
external get_by_classname : Dom.element -> string -> Dom.element
  = "getElementsByClassName"
  [@@mel.send]

let el = document |. get_by_id "my-id" |. get_by_classname "my-class"
```

```reasonml
/* Abstract type for the `document` global */
type document;

external document: document = "document";
[@mel.send]
external get_by_id: (document, string) => Dom.element = "getElementById";
[@mel.send]
external get_by_classname: (Dom.element, string) => Dom.element =
  "getElementsByClassName";

let el = document->(get_by_id("my-id"))->(get_by_classname("my-class"));
```

Will generate:

```javascript
var el = document.getElementById('my-id').getElementsByClassName('my-class')
```

Now with pipe last operator `|>`:

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
external get_by_id : string -> Dom.element = "getElementById"
  [@@mel.send.pipe: document]
external get_by_classname : string -> Dom.element = "getElementsByClassName"
  [@@mel.send.pipe: Dom.element]

let el = document |> get_by_id "my-id" |> get_by_classname "my-class"
```

```reasonml
/* Abstract type for the `document` global */
type document;

external document: document = "document";
[@mel.send.pipe: document]
external get_by_id: string => Dom.element = "getElementById";
[@mel.send.pipe: Dom.element]
external get_by_classname: string => Dom.element = "getElementsByClassName";

let el = document |> get_by_id("my-id") |> get_by_classname("my-class");
```

Will generate the same JavaScript as the pipe first version:

```javascript
var el = document.getElementById('my-id').getElementsByClassName('my-class')
```

### Variadic function arguments

Sometimes JavaScript functions take an arbitrary amount of arguments. For these
cases, Melange provides the `mel.variadic` attribute, which can be attached to
the `external` declaration. However, there is one caveat: all the variadic
arguments need to belong to the same type.

```ocaml
external join : string array -> string = "join"
  [@@mel.module "path"] [@@mel.variadic]
let v = join [| "a"; "b" |]
```

```reasonml
[@mel.module "path"] [@mel.variadic]
external join: array(string) => string = "join";
let v = join([|"a", "b"|]);
```

Generates:

```js
var Path = require('path')
var v = Path.join('a', 'b')
```

If more dynamism is needed, there is a way to inject elements with different
types in the array and still have Melange compile to JavaScript values that are
not wrapped using the OCaml
[`unboxed`](https://v2.ocaml.org/manual/attributes.html) attribute, which was
mentioned [in the OCaml attributes section](#reusing-ocaml-attributes):

```ocaml
type hide = Hide : 'a -> hide [@@unboxed]

external join : hide array -> string = "join" [@@mel.module "path"] [@@mel.variadic]

let v = join [| Hide "a"; Hide 2 |]
```

```reasonml
[@unboxed]
type hide =
  | Hide('a): hide;

[@mel.module "path"] [@mel.variadic]
external join: array(hide) => string = "join";

let v = join([|Hide("a"), Hide(2)|]);
```

Compiles to:

```javascript
var Path = require('path')

var v = Path.join('a', 2)
```

### Bind to a polymorphic function

Some JavaScript libraries will define functions where the arguments can vary on
both type and shape. There are two approaches to bind to those, depending on how
dynamic they are.

#### Approach 1: Multiple external functions

If it is possible to enumerate the many forms an overloaded JavaScript function
can take, a flexible approach is to bind to each form individually:

```ocaml
external drawCat : unit -> unit = "draw" [@@mel.module "MyGame"]
external drawDog : giveName:string -> unit = "draw" [@@mel.module "MyGame"]
external draw : string -> useRandomAnimal:bool -> unit = "draw"
  [@@mel.module "MyGame"]
```

```reasonml
[@mel.module "MyGame"] external drawCat: unit => unit = "draw";
[@mel.module "MyGame"] external drawDog: (~giveName: string) => unit = "draw";
[@mel.module "MyGame"]
external draw: (string, ~useRandomAnimal: bool) => unit = "draw";
```

Note how all three externals bind to the same JavaScript function, `draw`.

#### Approach 2: Polymorphic variant + `mel.unwrap`

In some cases, the function has a constant number of arguments but the type of
the argument can vary. For cases like this, we can model the argument as a
variant and use the `mel.unwrap` attribute in the external.

Let’s say we want to bind to the following JavaScript function:

```js
function padLeft(value, padding) {
  if (typeof padding === 'number') {
    return Array(padding + 1).join(' ') + value
  }
  if (typeof padding === 'string') {
    return padding + value
  }
  throw new Error(`Expected string or number, got '${padding}'.`)
}
```

As the `padding` argument can be either a number or a string, we can use
`mel.unwrap` to define it. It is important to note that `mel.unwrap` imposes
certain requirements on the type it is applied to:

- It needs to be a [polymorphic
  variant](https://v2.ocaml.org/manual/polyvariant.html)
- Its definition needs to be inlined
- Each variant tag needs to have an argument
- The variant type can not be opened (can’t use `>`)

```ocaml
external padLeft:
  string
  -> ([ `Str of string
      | `Int of int
      ] [@mel.unwrap])
  -> string
  = "padLeft"

let _ = padLeft "Hello World" (`Int 4)
let _ = padLeft "Hello World" (`Str "Message from Melange: ")
```

```reasonml
external padLeft:
  (string, [@mel.unwrap] [ | `Str(string) | `Int(int)]) => string =
  "padLeft";

let _ = padLeft("Hello World", `Int(4));
let _ = padLeft("Hello World", `Str("Message from Melange: "));
```

Which produces the following JavaScript:

```js
padLeft('Hello World', 4)
padLeft('Hello World', 'Message from Melange: ')
```

As we saw in the [Non-shared data types](#non-shared-data-types) section, we
should rather avoid passing variants directly to the JavaScript side. By using
`mel.unwrap` we get the best of both worlds: from Melange we can use variants,
while JavaScript gets the raw values inside them.

### Using polymorphic variants to bind to enums

Some JavaScript APIs take a limited subset of values as input. For example,
Node’s `fs.readFileSync` second argument can only take a few given string
values: `"ascii"`, `"utf8"`, etc. Some other functions can take values from a
few given integers, like the `createStatusBarItem` function in VS Code API,
which can take an `alignment` parameter that can only be [`1` or
`2`](https://github.com/Microsoft/vscode/blob/2362ec665c84a1519162b50c36ed4f29d1e20f62/src/vs/vscode.d.ts#L4098-L4109).

One could still type these parameters as just `string` or `int`, but this would
not prevent consumers of the external function from calling it using values that
are unsupported by the JavaScript function. Let’s see how we can use polymorphic
variants to avoid runtime errors.

If the values are strings, we can use the `mel.string` attribute:

```ocaml
external read_file_sync :
  name:string -> ([ `utf8 | `ascii ][@mel.string]) -> string = "readFileSync"
  [@@mel.module "fs"]

let _ = read_file_sync ~name:"xx.txt" `ascii
```

```reasonml
[@mel.module "fs"]
external read_file_sync:
  (~name: string, [@mel.string] [ | `utf8 | `ascii]) => string =
  "readFileSync";

let _ = read_file_sync(~name="xx.txt", `ascii);
```

Which generates:

```js
var Fs = require('fs')
Fs.readFileSync('xx.txt', 'ascii')
```

This technique can be combined with the `mel.as` attribute to modify the strings
produced from the polymorphic variant values. For example:

```ocaml
type document
type style

external document : document = "document"
external get_by_id : document -> string -> Dom.element = "getElementById"
[@@mel.send]
external style : Dom.element -> style = "style" [@@mel.get]
external transition_timing_function :
  style ->
  ([ `ease
   | `easeIn [@mel.as "ease-in"]
   | `easeOut [@mel.as "ease-out"]
   | `easeInOut [@mel.as "ease-in-out"]
   | `linear ]
  [@mel.string]) ->
  unit = "transitionTimingFunction"
[@@mel.set]

let element_style = style (get_by_id document "my-id")
let () = transition_timing_function element_style `easeIn
```

```reasonml
type document;
type style;

external document: document = "document";
[@mel.send]
external get_by_id: (document, string) => Dom.element = "getElementById";
[@mel.get] external style: Dom.element => style = "style";
[@mel.set]
external transition_timing_function:
  (
    style,
    [@mel.string] [
      | `ease
      | [@mel.as "ease-in"] `easeIn
      | [@mel.as "ease-out"] `easeOut
      | [@mel.as "ease-in-out"] `easeInOut
      | `linear
    ]
  ) =>
  unit =
  "transitionTimingFunction";

let element_style = style(get_by_id(document, "my-id"));
let () = transition_timing_function(element_style, `easeIn);
```

This will generate:

```javascript
var element_style = document.getElementById('my-id').style

element_style.transitionTimingFunction = 'ease-in'
```

Aside from producing string values, Melange also offers `mel.int` to produce
integer values. `mel.int` can also be combined with `mel.as`:

```ocaml
external test_int_type :
  ([ `on_closed | `on_open [@mel.as 20] | `in_bin ][@mel.int]) -> int
  = "testIntType"

let value = test_int_type `on_open
```

```reasonml
external test_int_type:
  ([@mel.int] [ | `on_closed | [@mel.as 20] `on_open | `in_bin]) => int =
  "testIntType";

let value = test_int_type(`on_open);
```

In this example, `on_closed` will be encoded as 0, `on_open` will be 20 due to
the attribute `mel.as` and `in_bin` will be 21, because if no `mel.as`
annotation is provided for a variant tag, the compiler continues assigning
values counting up from the previous one.

This code generates:

```js
var value = testIntType(20)
```

### Using polymorphic variants to bind to event listeners

Polymorphic variants can also be used to wrap event listeners, or any other kind
of callback, for example:

```ocaml
type readline

external on :
  readline ->
  ([ `close of unit -> unit | `line of string -> unit ][@mel.string]) ->
  readline = "on"
  [@@mel.send]

let register rl =
  rl |. on (`close (fun event -> ())) |. on (`line (fun line -> Js.log line))
```

```reasonml
type readline;

[@mel.send]
external on:
  (
    readline,
    [@mel.string] [ | `close(unit => unit) | `line(string => unit)]
  ) =>
  readline =
  "on";

let register = rl =>
  rl->(on(`close(event => ())))->(on(`line(line => Js.log(line))));
```

This generates:

```js
function register(rl) {
  return rl
    .on('close', function ($$event) {})
    .on('line', function (line) {
      console.log(line)
    })
}
```

### Constant values as arguments

Sometimes we want to call a JavaScript function and make sure one of the
arguments is always constant. For this, the `[@mel.as]` attribute can be
combined with the wildcard pattern `_`:

```ocaml
external process_on_exit : (_[@mel.as "exit"]) -> (int -> unit) -> unit
  = "process.on"

let () =
  process_on_exit (fun exit_code ->
    Js.log ("error code: " ^ string_of_int exit_code))
```

```reasonml
external process_on_exit: ([@mel.as "exit"] _, int => unit) => unit =
  "process.on";

let () =
  process_on_exit(exit_code =>
    Js.log("error code: " ++ string_of_int(exit_code))
  );
```

This generates:

```js
process.on('exit', function (exitCode) {
  console.log('error code: ' + exitCode.toString())
})
```

The `mel.as "exit"` and the wildcard `_` pattern together will tell Melange to
compile the first argument of the JavaScript function to the string `"exit"`.

You can also use any JSON literal by passing a quoted string to `mel.as`:
`mel.as {json|true|json}` or `mel.as {json|{"name": "John"}|json}`.

### Binding to callbacks

In OCaml, all functions have arity 1. This means that if you define a function
like this:

```ocaml
let add x y = x + y
```

```reasonml
let add = (x, y) => x + y;
```

Its type will be `int -> int -> int`. This means that one can partially apply
`add` by calling `add 1`, which will return another function expecting the
second argument of the addition. This kind of functions are called "curried"
functions, more information about currying in OCaml can be found in [this
chapter](https://cs3110.github.io/textbook/chapters/hop/currying.html) of the
"OCaml Programming: Correct + Efficient + Beautiful" book.

This is incompatible with how function calling conventions work in JavaScript,
where all function calls always apply all the arguments. To continue the
example, let’s say we have an `add` function implemented in JavaScript, similar
to the one above:

```javascript
var add = function (a, b) {
  return a + b
}
```

If we call `add(1)`, the function will be totally applied, with `b` having
`undefined` value. And as JavaScript will try to add `1` with `undefined`, we
will get `NaN` as a result.

To illustrate this difference and how it affects Melange bindings, let’s say we
want to write bindings for a JavaScript function like this:

```javascript
function map(a, b, f) {
  var i = Math.min(a.length, b.length)
  var c = new Array(i)
  for (var j = 0; j < i; ++j) {
    c[j] = f(a[i], b[i])
  }
  return c
}
```

A naive external function declaration could be as below:

```ocaml
external map : 'a array -> 'b array -> ('a -> 'b -> 'c) -> 'c array = "map"
```

```reasonml
external map: (array('a), array('b), ('a, 'b) => 'c) => array('c) = "map";
```

Unfortunately, this is not completely correct. The issue is in the callback
function, with type `'a -> 'b -> 'c`. This means that `map` will expect a
function like `add` described above. But as we said, in OCaml, having two
arguments means just to have two functions that take one argument.

Let’s rewrite `add` to make the problem a bit more clear:

```ocaml
let add x = let partial y = x + y in partial
```

```reasonml
let add = x => {
  let partial = y => x + y;
  partial;
};
```

This will be compiled to:

```javascript
function add(x) {
  return function (y) {
    return (x + y) | 0
  }
}
```

Now if we ever used our external function `map` with our `add` function by
calling `map arr1 arr2 add` it would not work as expected. JavaScript function
application does not work the same as in OCaml, so the function call in the
`map` implementation, `f(a[i],b[i])`, would be applied over the outer JavaScript
function `add`, which only takes one argument `x`, and `b[i]` would be just
discarded. The value returned from the operation would not be the addition of
the two numbers, but rather the inner anonymous callback.

To solve this mismatch between OCaml and JavaScript functions and their
application, Melange provides a special attribute `@u` that can be used to
annotate external functions that need to be "uncurried".

<span class="text-reasonml">In Reason syntax, this attribute does not need to be
written explicitly, as it is deeply integrated with the Reason parser. To
specify some function type as "uncurried", one just needs to add the dot
character `.` to the function type. For example, `(. 'a, 'b) => 'c` instead of
`('a, 'b) => 'c`.</span>

In the example above:

```ocaml
external map : 'a array -> 'b array -> (('a -> 'b -> 'c)[@u]) -> 'c array
  = "map"
```

```reasonml
external map: (array('a), array('b), (. 'a, 'b) => 'c) => array('c) = "map";
```

Here <span class="text-ocaml">`('a -> 'b -> 'c [@u])`</span><span
class="text-reasonml">`(. 'a, 'b) => 'c`</span>will be interpreted as having
arity 2. In general, <span class="text-ocaml">`'a0 -> 'a1 ...​ 'aN -> 'b0 [@u]`
is the same as `'a0 -> 'a1 ...​ 'aN -> 'b0`</span><span class="text-reasonml">`.
'a0, 'a1, ...​ 'aN => 'b0` is the same as `'a0, 'a1, ...​ 'aN => 'b0`</span>
except the former’s arity is guaranteed to be N while the latter is unknown.

If we try now to call `map` using `add`:

```ocaml
let add x y = x + y
let _ = map [||] [||] add
```

```reasonml
let add = (x, y) => x + y;
let _ = map([||], [||], add);
```

We will get an error:

```text
let _ = map [||] [||] add
                      ^^^
This expression has type int -> int -> int
but an expression was expected of type ('a -> 'b -> 'c) Js.Fn.arity2
```

To solve this, we add <span class="text-ocaml">`@u`</span><span
class="text-reasonml">`.`</span> in the function definition as well:

```ocaml
let add = fun [@u] x y -> x + y
```

```reasonml
let add = (. x, y) => x + y;
```

Annotating function definitions can be quite cumbersome when writing a lot of
externals.

To work around the verbosity, Melange offers another attribute called
`mel.uncurry`.

Let’s see how we could use it in the previous example. We just need to replace
`u` with `mel.uncurry`:

```ocaml
external map :
  'a array -> 'b array -> (('a -> 'b -> 'c)[@mel.uncurry]) -> 'c array = "map"
```

```reasonml
external map:
  (array('a), array('b), [@mel.uncurry] (('a, 'b) => 'c)) => array('c) =
  "map";
```

Now if we try to call `map` with a regular `add` function:

```ocaml
let add x y = x + y
let _ = map [||] [||] add
```

```reasonml
let add = (x, y) => x + y;
let _ = map([||], [||], add);
```

Everything works fine now, without having to attach any attributes to `add`.

The main difference between `u` and `mel.uncurry` is that the latter only works
with externals. `mel.uncurry` is the recommended option to use for bindings,
while `u` remains useful for those use cases where performance is crucial and we
want the JavaScript functions generated from OCaml ones to not be applied
partially.

### Modeling `this`\-based Callbacks

Many JavaScript libraries have callbacks which rely on the [`this`
keyword](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this),
for example:

```js
x.onload = function (v) {
  console.log(this.response + v)
}
```

Inside the `x.onload` callback, `this` would be pointing to `x`. It would not be
correct to declare `x.onload` of type `unit -> unit`. Instead, Melange
introduces a special attribute, `mel.this`, which allows to type `x` as this:

```ocaml
type x
external x : x = "x"
external set_onload : x -> ((x -> int -> unit)[@mel.this]) -> unit = "onload"
  [@@mel.set]
external resp : x -> int = "response" [@@mel.get]
let _ =
  set_onload x
    begin
      fun [@mel.this] o v -> Js.log (resp o + v)
    end
```

```reasonml
type x;
external x: x = "x";
[@mel.set]
external set_onload: (x, [@mel.this] ((x, int) => unit)) => unit = "onload";
[@mel.get] external resp: x => int = "response";
let _ = set_onload(x, [@mel.this] (o, v) => Js.log(resp(o) + v));
```

Which generates:

```javascript
x.onload = function (v) {
  var o = this
  console.log((o.response + v) | 0)
}
```

Note that the first argument will be reserved for `this`.

### Wrapping returned nullable values

JavaScript models `null` and `undefined` differently, whereas it can be useful
to treat both as <span class="text-ocaml">`'a option`</span><span
class="text-reasonml">`option('a)`</span> in Melange.

Melange understands the `mel.return` attribute in externals to model how
nullable return types should be wrapped at the bindings boundary. An `external`
value with `mel.return` converts the return value to an `option` type, avoiding
the need for extra wrapping / unwrapping with functions such as
`Js.Nullable.toOption`.

```ocaml
type element
type document
external get_by_id : document -> string -> element option = "getElementById"
  [@@mel.send] [@@mel.return nullable]

let test document =
  let elem = get_by_id document "header" in
  match elem with
  | None -> 1
  | Some _element -> 2
```

```reasonml
type element;
type document;
[@mel.send] [@mel.return nullable]
external get_by_id: (document, string) => option(element) = "getElementById";

let test = document => {
  let elem = get_by_id(document, "header");
  switch (elem) {
  | None => 1
  | Some(_element) => 2
  };
};
```

Which generates:

```js
function test($$document) {
  var elem = $$document.getElementById('header')
  if (elem == null) {
    return 1
  } else {
    return 2
  }
}
```

The `mel.return` attribute takes an attribute payload, as seen with <span
class="text-ocaml">`[@@mel.return nullable]`</span><span
class="text-reasonml">`[@mel.return nullable]`</span> above. Currently 4
directives are supported: `null_to_opt`, `undefined_to_opt`, `nullable` and
`identity`.

`nullable` is encouraged, as it will convert from `null` and `undefined` to
`option` type.

<!-- When the return type is unit: the compiler will append its return value with an OCaml unit literal to make sure it does return unit. Its main purpose is to make the user consume FFI in idiomatic OCaml code, the cost is very very small and the compiler will do smart optimizations to remove it when the returned value is not used (mostly likely). -->

`identity` will make sure that compiler will do nothing about the returned
value. It is rarely used, but introduced here for debugging purposes.

## Generate getters, setters and constructors

As we saw in a [previous section](#non-shared-data-types), there are some types
in Melange that compile to values that are not easy to manipulate from
JavaScript. To facilitate the communication from JavaScript code with values of
these types, Melange includes an attribute `deriving` that helps generating
conversion functions, as well as functions to create values from these types. In
particular, for variants and polymorphic variants.

Additionally, `deriving` can be used with record types, to generate setters and
getters as well as creation functions.

### Variants

#### Creating values

Use `@deriving accessors` on a variant type to create constructor values for
each branch.

```ocaml
type action =
  | Click
  | Submit of string
  | Cancel
[@@deriving accessors]
```

```reasonml
[@deriving accessors]
type action =
  | Click
  | Submit(string)
  | Cancel;
```

Melange will generate one `let` definition for each variant tag, implemented as
follows:

- For variant tags with payloads, it will be a function that takes the payload
  value as a parameter.
- For variant tags without payloads, it will be a constant with the runtime
  value of the tag.

Given the `action` type definition above, annotated with `deriving`, Melange
will generate something similar to the following code:

```ocaml
type action =
  | Click
  | Submit of string
  | Cancel

let click = (Click : action)
let submit param = (Submit param : action)
let cancel = (Cancel : action)
```

```reasonml
type action =
  | Click
  | Submit(string)
  | Cancel;

let click: action = Click;
let submit = (param): action => Submit(param);
let cancel: action = Cancel;
```

Which will result in the following JavaScript code after compilation:

```javascript
function submit(param_0) {
  return /* Submit */ {
    _0: param_0,
  }
}

var click = /* Click */ 0

var cancel = /* Cancel */ 1
```

Note the generated definitions are lower-cased, and they can be safely used from
JavaScript code. For example, if the above JavaScript generated code was located
in a `generators.js` file, the definitions can be used like this:

```javascript
const generators = require('./generators.js')

const hello = generators.submit('Hello')
const click = generators.click
```

#### Conversion functions

Use `@deriving jsConverter` on a variant type to create converter functions that
allow to transform back and forth between JavaScript integers and Melange
variant values.

There are a few differences with `@deriving accessors`:

- `jsConverter` works with the `mel.as` attribute, while `accessors` does not
- `jsConverter` does not support variant tags with payload, while `accessors`
  does
- `jsConverter` generates functions to transform values back and forth, while
  `accessors` generates functions to create values

Let’s see a version of the previous example, adapted to work with `jsConverter`
given the constraints above:

```ocaml
type action =
  | Click
  | Submit [@mel.as 3]
  | Cancel
[@@deriving jsConverter]
```

```reasonml
[@deriving jsConverter]
type action =
  | Click
  | [@mel.as 3] Submit
  | Cancel;
```

This will generate a couple of functions with the following types:

```ocaml
val actionToJs : action -> int

val actionFromJs : int -> action option
```

```reasonml
external actionToJs: action => int = ;

external actionFromJs: int => option(action) = ;
```

`actionToJs` returns integers from values of `action` type. It will start with 0
for `Click`, 3 for `Submit` (because it was annotated with `mel.as`), and then 4
for `Cancel`, in the same way that we described when [using `mel.int` with
polymorphic variants](#using-polymorphic-variants-to-bind-to-enums).

`actionFromJs` returns a value of type `option`, because not every integer can
be converted into a variant tag of the `action` type.

##### Hide runtime types

For extra type safety, we can hide the runtime representation of variants
(`int`) from the generated functions, by using `jsConverter { newType }` payload
with `@deriving`:

```ocaml
type action =
  | Click
  | Submit [@mel.as 3]
  | Cancel
[@@deriving jsConverter { newType }]
```

```reasonml
[@deriving jsConverter({newType: newType})]
type action =
  | Click
  | [@mel.as 3] Submit
  | Cancel;
```

This feature relies on [abstract types](#abstract-types) to hide the JavaScript
runtime representation. It will generate functions with the following types:

```ocaml
val actionToJs : action -> abs_action

val actionFromJs : abs_action -> action
```

```reasonml
external actionToJs: action => abs_action = ;

external actionFromJs: abs_action => action = ;
```

In the case of `actionFromJs`, the return value, unlike the previous case, is
not an option type. This is an example of "correct by construction": the only
way to create an `abs_action` is by calling the `actionToJs` function.

### Polymorphic variants

The `@deriving jsConverter` attribute is applicable to polymorphic variants as
well.

> **_NOTE:_** Similarly to variants, the `@deriving jsConverter` attribute
> cannot be used when the polymorphic variant tags have payloads. Refer to the
> [section on runtime representation](#data-types-and-runtime-representation) to
> learn more about how polymorphic variants are represented in JavaScript.

Let’s see an example:

```ocaml
type action =
  [ `Click
  | `Submit [@mel.as "submit"]
  | `Cancel
  ]
[@@deriving jsConverter]
```

```reasonml
[@deriving jsConverter]
type action = [ | `Click | [@mel.as "submit"] `Submit | `Cancel];
```

Akin to the variant example, the following two functions will be generated:

```ocaml
val actionToJs : action -> string

val actionFromJs : string -> action option
```

```reasonml
external actionToJs: action => string = ;

external actionFromJs: string => option(action) = ;
```

The `jsConverter { newType }` payload can also be used with polymorphic
variants.

### Records

#### Accessing fields

Use `@deriving accessors` on a record type to create accessor functions for its
record field names.

```ocaml
type pet = { name : string } [@@deriving accessors]

let pets = [| { name = "Brutus" }; { name = "Mochi" } |]

let () = pets |. Belt.Array.map name |. Js.Array.join ~sep:"&" |. Js.log
```

```reasonml
[@deriving accessors]
type pet = {name: string};

let pets = [|{name: "Brutus"}, {name: "Mochi"}|];

let () = pets->(Belt.Array.map(name))->(Js.Array.join(~sep="&"))->Js.log;
```

Melange will generate a function for each field defined in the record. In this
case, a function `name` that allows to get that field from any record of type
`pet`:

<!--#prelude#type pet = { name : string } [@@deriving accessors]-->

```ocaml
let name (param : pet) = param.name
```

```reasonml
let name = (param: pet) => param.name;
```

Considering all the above, the produced JavaScript will be:

```js
function name(param) {
  return param.name
}

var pets = [
  {
    name: 'Brutus',
  },
  {
    name: 'Mochi',
  },
]

console.log(Belt_Array.map(pets, name).join('&'))
```

#### Generate JavaScript objects with optional properties

In some occasions, we might want to emit a JavaScript object where some of the
keys can be conditionally present or absent.

For instance, consider the following record:

```ocaml
type person = {
  name : string;
  age : int option;
}
```

```reasonml
type person = {
  name: string,
  age: option(int),
};
```

An example of this use-case would be expecting `{ name = "John"; age = None }`
to generate a JavaScript object such as `{name: "Carl"}`, where the `age` key
doesn’t appear.

The `@deriving jsProperties` attribute exists to solve this problem. When
present in a record type, `@deriving jsProperties` generates a constructor
function for creating values of the type, where the fields marked with
`[@mel.optional]` will be fully removed from the generated JavaScript object
when their value is `None`.

Let’s see an example. Considering this Melange code:

```ocaml
type person = {
  name : string;
  age : int option; [@mel.optional]
}
[@@deriving jsProperties]
```

```reasonml
[@deriving jsProperties]
type person = {
  name: string,
  [@mel.optional]
  age: option(int),
};
```

Melange will generate a constructor to create values of this type. In our
example, the OCaml signature would look like this after preprocessing:

```ocaml
type person

val person : name:string -> ?age:int -> unit -> person
```

```reasonml
type person;

external person: (~name: string, ~age: int=?, unit) => person = ;
```

The `person` function can be used to create values of `person`. It is the only
possible way to create values of this type, since Melange makes it abstract.
Using literals like `{ name = "Alice"; age = None }` directly doesn’t type
check.

Here is an example of how we can use it:

<!--#prelude#
type person = {
  name : string;
  age : int option; [@mel.optional]
}
[@@deriving jsDeriving]
-->

```ocaml
let alice = person ~name:"Alice" ~age:20 ()
let bob = person ~name:"Bob" ()
```

```reasonml
let alice = person(~name="Alice", ~age=20, ());
let bob = person(~name="Bob", ());
```

This will generate the following JavaScript code. Note how there is no
JavaScript runtime overhead:

```js
var alice = {
  name: 'Alice',
  age: 20,
}

var bob = {
  name: 'Bob',
}
```

The `person` function uses labeled arguments to represent record fields. Because
there is an optional argument `age`, it takes a last argument of type `unit`.
This non-labeled argument allows to omit the optional argument on function
application. Further details about optional labeled arguments can be found in
[the corresponding section of the OCaml
manual](https://v2.ocaml.org/manual/lablexamples.html#s:optional-arguments).

#### Generating getters and setters

In case we need both getters and setters for a record, we can use `deriving
getSet` to have them generated for free.

If we take a record like this:

```ocaml
type person = {
  name : string;
  age : int option; [@mel.optional]
}
[@@deriving getSet]
```

```reasonml
[@deriving getSet]
type person = {
  name: string,
  [@mel.optional]
  age: option(int),
};
```

The `deriving` attribute can combine multiple derivers, for example we can
combine `jsProperties` with `getSet`:

```ocaml
type person = {
  name : string;
  age : int option; [@mel.optional]
}
[@@deriving jsProperties, getSet]
```

```reasonml
[@deriving (jsProperties, getSet)]
type person = {
  name: string,
  [@mel.optional]
  age: option(int),
};
```

When using `getSet`, Melange will create functions `nameGet` and `ageGet`, as
accessors for each record field.

<!--#prelude#
type person = {
  name : string;
  age : int option; [@mel.optional]
}
[@@deriving jsProperties, getSet]
let alice = person ~name:"Alice" ~age:20 ()
let bob = person ~name:"Bob" ()
-->

```ocaml
let twenty = ageGet alice

let bob = nameGet bob
```

```reasonml
let twenty = ageGet(alice);

let bob = nameGet(bob);
```

This generates:

```javascript
var twenty = alice.age

var bob = bob.name
```

The functions are named by appending `Get` to the field names of the record to
prevent potential clashes with other values within the module. If shorter names
are preferred for the getter functions, there is an alternate <code
class="text-ocaml">getSet { light }</code><code
class="text-reasonml">getSet({light: light})</code> payload that can be passed
to `deriving`:

```ocaml
type person = {
  name : string;
  age : int;
}
[@@deriving jsProperties, getSet { light }]

let alice = person ~name:"Alice" ~age:20
let aliceName = name alice
```

```reasonml
[@deriving (jsProperties, getSet({light: light}))]
type person = {
  name: string,
  age: int,
};

let alice = person(~name="Alice", ~age=20);
let aliceName = name(alice);
```

Which generates:

```javascript
var alice = {
  name: 'Alice',
  age: 20,
}

var aliceName = alice.name
```

In this example, the getter functions share the same names as the object fields.
Another distinction from the previous example is that the `person` constructor
function no longer requires the final `unit` argument since we have excluded the
optional field in this case.

> **_NOTE:_** The `mel.as` attribute can still be applied to record fields when
> the record type is annotated with `deriving`, allowing for the renaming of
> fields in the resulting JavaScript objects, as demonstrated in the section
> about [binding to objects with static
> shape](#objects-with-static-shape-record-like). However, the option to pass
> indices to the `mel.as` decorator (like `[@mel.as "0"]`) to change the runtime
> representation to an array is not available when using `deriving`.

##### Compatibility with OCaml features

The `@deriving getSet` attribute and its lightweight variant can be used with
[mutable
fields](https://v2.ocaml.org/manual/coreexamples.html#s:imperative-features) and
[private types](https://v2.ocaml.org/manual/privatetypes.html), which are
features inherited by Melange from OCaml.

When the record type has mutable fields, Melange will generate setter functions
for them. For example:

```ocaml
type person = {
  name : string;
  mutable age : int;
}
[@@deriving getSet]

let alice = person ~name:"Alice" ~age:20

let () = ageSet alice 21
```

```reasonml
[@deriving getSet]
type person = {
  name: string,
  mutable age: int,
};

let alice = person(~name="Alice", ~age=20);

let () = ageSet(alice, 21);
```

This will generate:

```javascript
var alice = {
  name: 'Alice',
  age: 20,
}

alice.age = 21
```

If the `mutable` keyword is omitted from the interface file, Melange will not
include the setter function in the module signature, preventing other modules
from mutating any values from the type.

Private types can be used to prevent Melange from creating the constructor
function. For example, if we define `person` type as private:

```ocaml
type person = private {
  name : string;
  age : int;
}
[@@deriving getSet]
```

```reasonml
[@deriving getSet]
type person =
  pri {
    name: string,
    age: int,
  };
```

The accessors `nameGet` and `ageGet` will still be generated, but not the
constructor `person`. This is useful when binding to JavaScript objects while
preventing any Melange code from creating values of such type.

## Use Melange code from JavaScript

As mentioned in the [build system
section](build-system.md#commonjs-or-es6-modules), Melange allows to produce
both CommonJS and ES6 modules. In both cases, using Melange-generated JavaScript
code from any hand-written JavaScript file works as expected.

The following definition:

```ocaml
let print name = "Hello" ^ name
```

```reasonml
let print = name => "Hello" ++ name;
```

Will generate this JavaScript code, when using CommonJS (the default):

```js
function print(name) {
  return 'Hello' + name
}

exports.print = print
```

When using ES6 (through the `(module_systems es6)` field in `melange.emit`) this
code will be generated:

```js
function print(name) {
  return 'Hello' + name
}

export { print }
```

So one can use either `require` or `import` (depending on the module system of
choice) to import the `print` value in a JavaScript file.

### Default ES6 values

One special case occur when working with JavaScript imports in ES6 modules that
look like this:

```js
import ten from 'numbers.js'
```

This import expects `numbers.js` to have a default export, like:

```js
export default ten = 10
```

To emulate this kind of exports from Melange, one just needs to define a
`default` value.

For example, in a file named <code class="text-ocaml">numbers.ml</code><code
class="text-reasonml">numbers.re</code>:

```ocaml
let default = 10
```

```reasonml
let default = 10;
```

That way, Melange will set the value on the `default` export so it can be
consumed as default import on the JavaScript side.
