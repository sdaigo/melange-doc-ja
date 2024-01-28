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

単一の非 `null` コンストラクタを持つバリアント：

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

以下は、Melange と JavaScript の間でほぼ「そのまま」共有できる型です。具体的な注意点は、該当するセクションに記載しています。

#### Strings

JavaScript の文字列は、UTF-16 でエンコードされた Unicode テキストの不変なシーケンスです。OCaml の文字列は不変のバイト列であり、テキストコンテンツとして解釈される場合、最近では UTF-8 でエンコードされたテキストであると仮定されます。これは JavaScript コードとやりとりする際に問題となります：

```ocaml
let () = Js.log "你好"
```

```reasonml
let () = Js.log("你好");
```

これは、不可解なコンソール出力につながります。これを修正するために、Melange では`js`識別子を使って[引用符付きの文字列リテラル](https://v2.ocaml.org/manual/lex.html#sss:stringliterals)を定義できます：

```ocaml
let () = Js.log {js|你好，
世界|js}
```

```reasonml
let () = Js.log({js|你好，
世界|js});
```

これは JavaScript の文字列補間に似ていますが、変数にのみ適用されます（任意の式には適用されません）：

```ocaml
let world = {j|世界|j}
let helloWorld = {j|你好，$world|j}
```

```reasonml
let world = {j|世界|j};
let helloWorld = {j|你好，$world|j};
```

補間変数を括弧で囲むこともできます： `{j|你 好，$(world)|j}`

文字列を扱うために、Melange 標準ライブラリは`Stdlib.String`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Stdlib/String) / [Reason](https://melange.re/v2.2.0/api/re/melange/Stdlib/String)）でいくつかのユーティリティを提供しています。文字列を扱うための JavaScript ネイティブ関数へのバインディングは、`Js.String モジュール`（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/String) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/String)）にあります。

#### Floating-point numbers

OCaml の浮動小数点数は[IEEE 754](https://en.wikipedia.org/wiki/Double-precision_floating-point_format#IEEE_754_double-precision_binary_floating-point_format:_binary64)で、仮数は 53 ビット、指数は-1022 ～ 1023 です。これは[JavaScript の数値](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_encoding)と同じエンコーディングであるため、これらの型の値は Melange コードと JavaScript コードの間で透過的に使用できます。Melange 標準ライブラリは`Stdlib.Float` モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Stdlib/Float) / [Reason](https://melange.re/v2.2.0/api/re/melange/Stdlib/Float)）を提供しています。浮動小数点値を操作する JavaScript API へのバインディングは、`Js.Float`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Float) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Float)）にあります。

#### Integers

Melange では、JavaScript のビット演算の[固定幅変換]()のため、整数は 32 ビットに制限されています。Melange の整数は JavaScript の数値にコンパイルされますが、これらを互換的に扱うと、精度の違いにより予期せぬ動作になる可能性があります。JavaScript のビット演算は 32 ビットに制限されていますが、整数自体は[数値と同じ](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_encoding)浮動小数点フォーマットを使って表現されるため、Melange に比べて JavaScript で表現可能な整数の範囲が広くなっています。大きな数値を扱う場合は、代わりに浮動小数点を使うことが推奨されます。例えば、`Js.Date`のようなバインディングでは float が使われます。

Melange 標準ライブラリには`Stdlib.Int`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Stdlib/Int) / [Reason](https://melange.re/v2.2.0/api/re/melange/Stdlib/Int)）が用意されています。JavaScript の整数を扱うバインディングは`Js.Int`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Int) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Int)）にあります。

#### Arrays

Melange の配列は JavaScript の配列にコンパイルされます。しかし JavaScript の配列とは異なり、Melange 配列のすべての値は同じ型である必要があることに注意してください。

もう 1 つの違いは、OCaml の配列は固定サイズですが、Melange 側ではこの制約が緩和されていることです。配列の長さを変更するには、`Js.Array.push`などの関数を使用します。`Js.Array`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Array) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Array)）の JavaScript API バインディングで使用できます。

Melange の標準ライブラリにも配列を扱うモジュールがあり、`Stdlib.Array`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Stdlib/Array) / [Reason](https://melange.re/v2.2.0/api/re/melange/Stdlib/Array)）で利用できます。

#### Tuples

OCaml のタプルは JavaScript の配列にコンパイルされます。これは、異種値を持つ JavaScript 配列を使用するバインディングを書くときに便利ですが、たまたま固定長でした。

実際の例としては、[ReasonReact](https://github.com/reasonml/reason-react/)という[React](https://react.dev/)用の Melange バインディングがあります。このバインディングでは、コンポーネント効果の依存関係は OCaml タプルとして表現され、Melange によって JavaScript 配列にきれいにコンパイルされます。

例えば、以下のようなコードです：

```ocaml
let () = React.useEffect2 (fun () -> None) (foo, bar)
```

```reasonml
let () = React.useEffect2(() => None, (foo, bar));
```

このコードは以下のように JavaScript にコンパイルされます:

```javascript
React.useEffect(function () {}, [foo, bar])
```

#### Booleans

`bool`型の値は JavaScript のブール値にコンパイルされます。

#### Records

Melange レコードは JavaScript オブジェクトに直接マッピングされます。レコードフィールドに非共有データ型（バリアントなど）が含まれている場合、これらの値は JavaScript で直接使用せず、別途変換する必要があります。

レコードを使用した JavaScript オブジェクトとのインターフェイスに関する広範なドキュメントは、[以下のセクション](#bind-to-javascript-objects)にあります。

#### Regular expressions

`%mel.re`拡張ノードを使用して作成された正規表現は、JavaScript の対応するものにコンパイルされます。

例：

```ocaml
let r = [%mel.re "/b/g"]
```

```reasonml
let r = [%mel.re "/b/g"];
```

このコードは以下のように JavaScript にコンパイルされます:

```js
var r = /b/g
```

上記のような正規表現は`Js.Re.t`型です。`Js.Re`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Re) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Re)）は、正規表現を操作する JavaScript 関数へのバインディングを提供します。

## Non-shared data types

以下の型は Melange と JavaScript で大きく異なるため、JavaScript から操作することは可能ですが、変換してから操作することが推奨されます。

- Variants と Polymorphic variants：JavaScript から操作する前に、読みやすい JavaScript の値に変換しておくとよいでしょう。Melange では[いくつかのヘルパー](#generate-getters-setters-and-constructors)を用意しています
- 例外
- Option（Variant 型）：`Js.Nullable`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Nullable) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Nullable)）の`Js.Nullable.fromOption`関数と`Js.Nullable.toOption`関数を使用して、`null`または`undefined`値に変換する方が良いでしょう
- List（Variant 型）：`Stdlib.Array`モジュール（[OCaml](https://melange.re/v2.2.0/api/re/melange/Stdlib/Array) / [Reason](https://melange.re/v2.2.0/api/re/melange/Stdlib/Array)）の`Array.of_list`と`Array.to_list`を使います
- Character
- Int64
- Lazy な値

## attributes と extension nodes のリスト

**Attributes:**

これらの attributes は、`external`定義の注釈に使用されます：

- [`mel.get`](#bind-to-object-properties): JavaScript オブジェクトのプロパティを、`.` 記法を使って静的に名前から読み込む
- [`mel.get_index`](#bind-to-object-properties): JavaScript オブジェクトのプロパティを`[]`括弧記法で動的に読み込む
- [`mel.module`](#using-functions-from-other-javascript-modules): JavaScript モジュールの値にバインドする
- [`mel.new`](#javascript-classes): JavaScript クラスのコンストラクタにバインドする
- [`mel.obj`](#using-external-functions): JavaScript オブジェクトを作成する
- [`mel.return`](#wrapping-returned-nullable-values): `null`可能な値から `Option.t` 値への自動変換
- [`mel.send`](#calling-an-object-method): JavaScript オブジェクトのメソッドを Pipe first で呼び出す
- [`mel.send.pipe`](#calling-an-object-method): JavaScript オブジェクトのメソッドを Pipe last で呼び出す
- [`mel.set`](#bind-to-object-properties): JavaScript オブジェクトのプロパティを、`.`記法を使って静的にセットする
- [`mel.set_index`](#bind-to-object-properties): JavaScript オブジェクトのプロパティを`[]`を使って動的に設定する
- [`mel.scope`](#binding-to-properties-inside-a-module-or-global): JavaScript オブジェクト内部のより深いプロパティにアクセスする
- [`mel.splice`](#variadic-function-arguments): 非推奨の属性で、`mel.variadic` の代替形式
- [`mel.variadic`](#variadic-function-arguments): 配列から多様な引数を取る関数にバインドする

これらの attributes は、`external`定義における引数の注釈に使用されます：

- [`u`](#binding-to-callbacks): 関数の引数を uncurried として定義（手動）
- [`mel.int`](#using-polymorphic-variants-to-bind-to-enums): 関数の引数を int にコンパイルする
- [`mel.string`](#using-polymorphic-variants-to-bind-to-enums): 関数の引数を文字列にコンパイルする
- [`mel.this`](#modeling-this-based-callbacks): `this` ベースのコールバックにバインドする
- [`mel.uncurry`](#binding-to-callbacks): 関数の引数を uncurried として定義する(自動)
- [`mel.unwrap`](#approach-2-polymorphic-variant-bsunwrap): Variant 値のアンラップ

これらの attributes は、レコード、フィールド、引数、関数などの場所で使用されます：

- `mel.as`: JavaScript の出力コードで生成される名前を再定義します。[定数関数の引数](#constant-values-as-arguments)、[Variants](#conversion-functions)、Polymorphic variants（[exteranl 関数のインライン化](#using-polymorphic-variants-to-bind-to-enums)または[型定義](#polymorphic-variants)）、[レコードフィールド](#objects-with-static-shape-record-like)で使用されます
- [`deriving`](#generate-getters-setters-and-constructors): 型のゲッターとセッターを生成します
- [`mel.inline`](#inlining-constant-values): 定数値を強制的にインライン化します
- [`optional`](#generate-javascript-objects-with-optional-properties): レコードのフィールドを省略します（`deriving`と組み合わせる）

**Extension nodes:**

これらの拡張ノードを使用するには、melange PPX プリプロセッサをプロジェクトに追加する必要があります。そのためには、`dune` ファイルに以下を追加してください：

```clojure
(library
 (name lib)
 (modes melange)
 (preprocess
   (pps melange.ppx)))
```

同じフィールドの`preprocess`を`melange.emit`に追加することができる。

以下は、Melange がサポートしているすべての Extension nodes のリストです：

- [`mel.debugger`](#debugger): `debugger`文を挿入する
- [`mel.external`](#detect-global-variables): グローバル値を読む
- [`mel.obj`](#using-jst-objects): JavaScript オブジェクトリテラルを作成する
- [`mel.raw`](#generate-raw-javascript): 生の JavaScript コードを書く
- [`mel.re`](#regular-expressions):　正規表現を挿入する

## Generate raw JavaScript

Melange ファイルから JavaScript コードを直接記述することは可能です。これは安全ではありませんが、プロトタイプを作成するときや、逃げ道として便利です。

これを行うには、[`mel.raw`拡張](https://v2.ocaml.org/manual/extensionnodes.html)を使用します：

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

`{||}` 文字列は[引用符付き文字列](https://ocaml.org/manual/lex.html#quoted-string-id)と呼ばれます。これらは JavaScript のテンプレート・リテラルに似ており、複数行にまたがるという意味で、文字列の内部で文字をエスケープする必要はありません。

角括弧で囲った Extension 名を使用すると (`[%mel.raw <string>]`) 、実装が直接 JavaScript である式 (関数本体やその他の値) を定義するのに便利です。これは、同じ行ですでに型シグネチャを付けることができるので便利で、コードをより安全にすることができます。例えば：

```ocaml
let f : unit -> int = [%mel.raw "function() {return 1}"]
```

```reasonml
let f: unit => int = ([%mel.raw "function() {return 1}"]: unit => int);
```

角括弧のない Extension 名（`%mel.raw <string>`）は、[構造体](https://v2.ocaml.org/manual/moduleexamples.html#s:module:structures)や[シグネチャ](https://v2.ocaml.org/manual/moduleexamples.html#s%3Asignature)の定義に使われます。

例：

```ocaml
[%%mel.raw "var a = 1"]
```

```reasonml
[%%mel.raw "var a = 1"];
```

## Debugger

Melange では、`mel.debugger` Extension を使用して `debugger;` 式を注入することができます：

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

出力：

```javascript
function f(x, y) {
  debugger // JavaScript developer tools will set a breakpoint and stop here
  return (x + y) | 0
}
```

## Detect global variables

Melange は、JavaScript の実行環境で定義されたグローバルを使用するための比較的型安全なアプローチを提供しています： `mel.external`。

`[%mel.external id]`は JavaScript の値`id`が`undefined`かどうかをチェックし、それに応じて`Option.t`値を返します。

例：

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

例：

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

JavaScript のイディオムの中には、インライン化するために特別な定数を必要とするものがあります。一般的な例は `process.env.NODE_ENV` です：

```js
if (process.env.NODE_ENV !== 'production') {
  // Development-only code
}
```

このコードは以下のようになります:

```js
if ('development' !== 'production') {
  // Development-only code
}
```

この場合、Webpack などのバンドラーは、`if`文が常に特定のブランチで評価されることを判別し、他のブランチを排除することができます。

Melange は、生成された JavaScript で同じ目標を達成するために`mel.inline` attribute を提供します。例を見てみましょう：

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

以下に示す生成された JavaScript を見ればわかります：

- `development` 変数がエミットされる
  - 変数`process.env.NODE_ENV !== development`として`if`文で使用される
- `development_inline`変数が最終出力に存在しない
  - この値は`if`文内でインライン化される: `process.env.NODE_ENV !== "development"`

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

JavaScript のオブジェクトは、さまざまなユースケースで使用されます：

- 固定の型の[レコード](<https://en.wikipedia.org/wiki/Record_(computer_science)>)
- マップまたは辞書
- クラス
- インポート/エクスポートするモジュール

Melange では、これら 4 つのユースケースに基づいて JavaScript オブジェクトのバインディングメソッドを分けています。このセクションでは、最初の 3 つについて説明します。JavaScript モジュールオブジェクトへのバインディングについては、[「他の JavaScript モジュールからの関数の使用」](#using-functions-from-other-javascript-modules)で説明します。

<!-- TODO: mention scope here too? -->

### Objects with static shape (record-like)

#### Using OCaml records

JavaScript オブジェクトに固定フィールドがある場合、それは概念的に[OCaml のレコード](https://v2.ocaml.org/manual/coreexamples.html#s%3Atut-recvariants)のようなものです。Melange はレコードを JavaScript オブジェクトにコンパイルするため、JavaScript オブジェクトにバインドする最も一般的な方法はレコードを使用することです。

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

以下のように JavaScript が生成されます：

```js
var MySchool = require('MySchool')

var john_name = MySchool.john.name
```

Exteranl 関数については[前のセクション](#external-関数)で説明しました。`mel.module` attribute は[ここ](#using-functions-from-other-javascript-modules)に書かれています。

Melange 側と JavaScript 側で異なるフィールド名を使用したい、または使用する必要がある場合は、`mel.as`デコレータを使用できます：

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

以下のように JavaScript が生成されます：

```js
var action = {
  type: 'ADD_USER',
}
```

これは、Melange で表現できない JavaScript の属性名にマッピングするのに便利です。たとえば、生成したい JavaScript の名前が[予約語](https://v2.ocaml.org/manual/lex.html#sss:keywords)である場合などです。

`mel.as`デコレーターにインデクスを渡すことで、Melange レコードを JavaScript の配列にマッピングすることも可能です：

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

以下のように JavaScript が生成されます：

```js
var value = [7, 'baz']
```

#### Using `Js.t` objects

レコードの代わりに、Melange は JavaScript オブジェクトを生成するために使用できる別の型を提供しています。この型は`'a Js.t`で、`'a`は[OCaml のオブジェクト](https://v2.ocaml.org/manual/objectexamples.html)です。

オブジェクトとレコードを比較した場合の利点は、事前に型宣言を行う必要がないため、プロトタイピングや JavaScript のオブジェクトリテラルを素早く生成するのに役立ちます。

Melange では、`Js.t`オブジェクトの値を作成する方法や、オブジェクト内のプロパティにアクセスする方法を提供しています。値を作成するには、`[%mel.obj]` 拡張子を使用し、`##` infix 演算子でオブジェクトのプロパティを読み込むことができます：

```ocaml
let john = [%mel.obj { name = "john"; age = 99 }]
let t = john##name
```

```reasonml
let john = {"name": "john", "age": 99};
let t = john##name;
```

以下のように JavaScript が生成されます：

```js
var john = {
  name: 'john',
  age: 99,
}

var t = john.name
```

オブジェクト型にはレコード型にはない柔軟性があることに注意してください。例えば、あるオブジェクト型を、より少ない値やメソッドを持つ別のオブジェクト型に強制することができますが、レコード型を、より少ないフィールドを持つ別のオブジェクト型に強制することは不可能です。そのため、いくつかのメソッドを共有する異なるオブジェクト型を、共通のメソッドだけが見えるデータ構造の中に混在させることができます。

例えば、文字列型のフィールド`name`を含むすべてのオブジェクト型で操作する関数を作ることができます：

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

オブジェクトとポリモーフィズムについてもっと読むには、[OCaml のドキュメント](https://ocaml.org/docs/objects)か[OCaml のマニュアル](https://v2.ocaml.org/manual/objectexamples.html)をチェックしてください。

#### Using external functions

[`Js.t`値と`mel.obj`extension](#using-jst-objects)を使って JavaScript のオブジェクト・リテラルを作成する方法についてはすでに説明しました。

Melange はさらに`mel.obj` attribute を提供しており、外部関数と組み合わせて JavaScript オブジェクトを作成することができます。これらの関数が呼び出されると、関数のラベル付き引数に対応するフィールドを持つオブジェクトが生成されます。

これらのラベル付き引数のいずれかがオプショナルとして定義され、関数適用時に省略された場合、結果の JavaScript オブジェクトは対応するフィールドを除外します。これにより、実行時オブジェクトを作成し、オプショナルキーが実行時に発行されるかどうかを制御することができます。

例えば、次のような JavaScript オブジェクトにバインドする必要がある場合：

```js
var homeRoute = {
  type: 'GET',
  path: '/',
  action: () => console.log('Home'),
  // options: ...
}
```

最初の 3 つのフィールドは必須で、オプション・フィールドは任意です。バインディング関数は次のように宣言します：

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

関数末尾の空文字列は、構文的に有効にするために使用されることに注意してください。この文字列の値はコンパイラによって無視されます。

オプションの引数`options`があるので、その後ろに`unit`型のラベルのない引数が追加されます。これにより、関数の適用時にオプション引数を省略することができます。ラベル付きオプション引数の詳細については、[OCaml のマニュアル](https://v2.ocaml.org/manual/lablexamples.html#s:optional-arguments)を参照してください。

関数の戻り値の型は、ワイルドカード型 `_` を使って指定しないでおきます。Melange は自動的に結果の JavaScript オブジェクトの型を推測します。

route 関数では、`_type`引数はアンダースコアで始まります。OCaml の予約語であるフィールドを持つ JavaScript オブジェクトにバインドする場合、Melange ではラベル付き引数にアンダースコアの接頭辞を使用できます。その結果、JavaScript オブジェクトのフィールド名からアンダースコアが取り除かれます。これは`mel.obj` attribute の場合のみ必要で、それ以外の場合は`mel.as` attribute を使用してフィールド名を変更することができます。

このように関数を呼び出すと：

```ocaml
let homeRoute = route ~_type:"GET" ~path:"/" ~action:(fun _ -> Js.log "Home") ()
```

```reasonml
let homeRoute =
  route(~_type="GET", ~path="/", ~action=_ => Js.log("Home"), ());
```

以下のような JavaScript が生成され、`options`フィールドは引数に与えられていないため、含まれません：

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

JavaScript オブジェクトのプロパティにのみバインドする必要がある場合、`mel.get`と`mel.set`を使って`.`記法でアクセスすることができます：

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

以下のように JavaScript が生成されます：

```javascript
var current = document.title
document.title = 'melange'
```

Alternatively, if some dynamism is required on the way the property is accessed,
you can use `mel.get_index` and `mel.set_index` to access it using the bracket
notation `[]`:

また、動的にプロパティへアクセスする場合は、`mel.get_index`と`mel.set_index`を使って、括弧記法`[]`でアクセスできます：

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

以下のように JavaScript が生成されます：

```js
var i32arr = new Int32Array(3)
i32arr[0] = 42
console.log(i32arr[0])
```

### Objects with dynamic shape (dictionary-like)

JavaScript のオブジェクトが辞書として使われることもあります。このような場合：

- オブジェクトに格納された値はすべて同じ型に属する
- キーと値のペアは、実行時に追加または削除できる

このような JavaScript オブジェクトを使用する場合、Melange では特定の型`Js.Dict.t`を公開しています。この型の値および値を扱う関数は、`Js.Dict`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Dict) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Dict)）で定義されており、`get`、`set`などの操作が可能です。

`Js.Dict.t`型の値は、JavaScript オブジェクトにコンパイルされます。

### JavaScript classes

JavaScript のクラスは特殊なオブジェクトです。クラスと相互作用するために、Melange は例えば`new Date()`をエミュレートする`mel.new`を公開しています：

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

以下のように JavaScript が生成されます：

```js
var date = new Date()
```

扱いたい JavaScript クラスが別の JavaScript モジュールにある場合、`mel.new`と`mel.module`をチェインさせることができます：

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

以下のように JavaScript が生成されます：

```js
var Book = require('Book')
var myBook = new Book()
```

## Bind to JavaScript functions or values

### Using global functions or values

グローバルに利用可能な JavaScript 関数へのバインディングは、オブジェクトと同様に`external`を利用します。しかし、オブジェクトとは異なり、attributes を追加する必要はありません：

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

> **_NOTE:_** `setTimeout`と`clearTimeout`のバインディングは、ここでは学習のために示していますが、これらはすで`Js.Global`モジュール（[OCaml](https://melange.re/v2.2.0/api/ml/melange/Js/Global) / [Reason](https://melange.re/v2.2.0/api/re/melange/Js/Global)）で利用可能です。

以下のように JavaScript が生成されます：

```javascript
var id = setTimeout(function (param) {
  console.log('hello')
}, 100)

clearTimeout(id)
```

グローバルバインディングは値にも適用できます：

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

以下のように JavaScript が生成されます：

```javascript
var doc = document
```

### Using functions from other JavaScript modules

`mel.module`は、他の JavaScript モジュールに属する値にバインドすることができます。モジュールの名前か相対パスを文字列で指定します。

```ocaml
external dirname : string -> string = "dirname" [@@mel.module "path"]
let root = dirname "/User/github"
```

```reasonml
[@mel.module "path"] external dirname: string => string = "dirname";
let root = dirname("/User/github");
```

以下のように JavaScript が生成されます：

```js
var Path = require('path')
var root = Path.dirname('/User/github')
```

### Binding to properties inside a module or global

モジュールやグローバル JavaScript オブジェクト内のプロパティにバインディングを作成する必要がある場合、Melange は`mel.scope` attribute を提供します。

例えば、[`vscode`パッケージ](https://code.visualstudio.com/api/references/vscode-api#commands)の特定のプロパティコマンドに対するバインディングを書きたい場合、次のようにします：

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

以下のようにコンパイルされます：

```javascript
var Vscode = require('vscode')

function f(a, b, c) {
  Vscode.commands.executeCommands('hi', a, b, c)
}
```

`mel.scope`属性は、ペイロードとして複数の引数を取ることができます。

例：

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

以下のように JavaScript が生成されます：

```javascript
var ExpoCamera = require('expo-camera')

var camera_type_back = ExpoCamera.Camera.Constants.Type.back
```

`mel.module`を使わずに、グローバル値へのスコープ付きバインディングを作成することができます：

```ocaml
external imul : int -> int -> int = "imul" [@@mel.scope "Math"]

let res = imul 1 2
```

```reasonml
[@mel.scope "Math"] external imul: (int, int) => int = "imul";

let res = imul(1, 2);
```

以下のように JavaScript が生成されます：

```javascript
var res = Math.imul(1, 2)
```

また、`mel.new`と併用することもできます：

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

以下のように JavaScript が生成されます：

```javascript
var DatGui = require('dat.gui')

var gui = new DatGui.default.GUI()
```

### Labeled arguments

OCaml には[ラベル付き引数](https://v2.ocaml.org/manual/lablexamples.html)があり、これはオプションでも可能で、`external`でも動作します。

ラベル付き引数は、Melange から呼び出される JavaScript 関数の引数に関する詳細情報を提供するのに便利です。

例えば、次のような JavaScript 関数を Melange から呼び出すとします：

```js
// MyGame.js

function draw(x, y, border) {
  // let’s assume `border` is optional and defaults to false
}
draw(10, 20)
draw(20, 20, true)
```

Melange バインディングを記述する際、ラベル付き引数を追加することで、より明確にすることができます：

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

以下のように JavaScript が生成されます：

```js
var MyGame = require('MyGame')

MyGame.draw(10, 20, true)
MyGame.draw(10, 20, undefined)
```

生成される JavaScript 関数は同じですが、Melange での使い方がより明確になります。

**Note**: この例では最後の引数の方は unit で、`()`を`border`の後に加えなければなりません。なぜなら、`border`は最後の位置でオプションの引数だからです。最後の param が unit 型でない場合には警告が出ますが、これは[OCaml のドキュメント](https://ocaml.org/docs/labels#warning-this-optional-argument-cannot-be-erased)で詳しく説明されています。

Melange 側で関数を適用する際、ラベル付けされた引数を自由に並べ替えることができることに注意してください。生成されるコードでは、関数宣言時に使用された元の順序が維持されます：

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

以下のように JavaScript が生成されます：

```js
var MyGame = require('MyGame')

MyGame.draw(10, 20, undefined)
MyGame.draw(10, 20, undefined)
```

### Calling an object method

JavaScript のメソッドを呼び出す必要がある場合、Melange には`mel.send`という属性があります。

> 以下のスニペットでは、ライブラリ`melange.dom`で提供されている`Dom.element`型を参照します。`dune`ファイルに`(libraries melange.dom)`をインクルードすることで、プロジェクトに追加することができます：

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

以下のように JavaScript が生成されます：

```js
var el = document.getElementById('my-id')
```

`mel.send`を使用する場合、第一引数は呼び出したい関数を持つプロパティを保持するオブジェクトになります。これは pipe first 演算子（Ocaml: `|.` / Reason: `->`）とうまく組み合わされます。

バインディングを OCaml の pipe last 演算子`|>`で使用するように設計したい場合、代替の`mel.send.pipe`属性があります。それを使って上の例を書き換えてみましょう：

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

`mel.send`と同じコードを生成します：

```js
var el = document.getElementById('my-id')
```

#### Chaining

この種の API は JavaScript でよく見られます: `foo().bar().baz()`。この種の API は、Melange external で 設計することができます。どちらの規約を使用するかによって、2 つの attributes が利用できます：

- データファーストの場合、`mel.send`属性と[pipe first 演算子](#pipe-first)（Ocaml: `|.` / Reason: `->`）を組み合わせます。
- データラストの場合、`mel.send.pipe`属性と OCaml の[pipe last 演算子](#pipe-last)`|>`を組み合わせます。

Let’s see first an example of chaining using data-first convention with the pipe
first operator <code class="text-ocaml">\|.</code><code
class="text-reasonml">\-\></code>:

まず、pipe first 演算子（Ocaml: `|.` / Reason: `->`）を使ったデータ・ファーストによるチェインの例を見てみましょう：

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
[@@mel.send]
external get_by_id : document -> string -> Dom.element = "getElementById"
[@@mel.send]
external get_by_classname : Dom.element -> string -> Dom.element
  = "getElementsByClassName"

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

以下のように JavaScript が生成されます：

```javascript
var el = document.getElementById('my-id').getElementsByClassName('my-class')
```

では、pipe last 演算子 `|>`の場合:

```ocaml
(* Abstract type for the `document` global *)
type document

external document : document = "document"
[@@mel.send.pipe: document]
external get_by_id : string -> Dom.element = "getElementById"
[@@mel.send.pipe: Dom.element]
external get_by_classname : string -> Dom.element = "getElementsByClassName"

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

以下のように pipe first の場合と同じ JavaScript が生成されます：

```javascript
var el = document.getElementById('my-id').getElementsByClassName('my-class')
```

### Variadic function arguments

JavaScript の関数は任意の数の引数を取ることがあります。このような場合、Melange では`mel.variadic` attribute を `external`に付加することができます。ただし、1 つだけ注意点があります。variadic 引数はすべて同じ型に属する必要があります。

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

以下のように JavaScript が生成されます：

```js
var Path = require('path')
var v = Path.join('a', 'b')
```

さらにダイナミズムが必要な場合は、[OCaml attributes のセクション](#reusing-ocaml-attributes) で説明した OCaml [`unboxed`](https://v2.ocaml.org/manual/attributes.html) attribute を使用して、異なる型の要素を配列に挿入し、ラップされていない JavaScript の値に Melange をコンパイルする方法があります：

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

以下のようにコンパイルされます：

```javascript
var Path = require('path')

var v = Path.join('a', 2)
```

### Bind to a polymorphic function

JavaScript ライブラリの中には、引数の型や形が変化する関数を定義しているものがあります。そのような関数にバインドするには、それがどの程度動的かによって 2 つのアプローチがあります。

#### Approach 1: 複数の external 関数

オーバーロードされた JavaScript 関数が取りうるフォームを数多く列挙できるのであれば、柔軟なアプローチとしては、それぞれのフォームに個別にバインドすることです：

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

3 つの external 関数がすべて同じ JavaScript 関数`draw`にバインドされていることに注目してください。

#### Approach 2: Polymorphic variant + `mel.unwrap`

場合によっては、関数の引数の数は一定だが、引数の型が異なることがある。このような場合、引数を Variant としてモデル化し、外部で`mel.unwrap` attribute を使用することができます。

次の JavaScript 関数にバインドしたいとします：

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

`padding` 引数は数値でも文字列でもよいので、`mel.unwrap` を使って定義することができます。重要なのは、`mel.unwrap`が適用される型に一定の要件を課すことです：

- [多相 Variant](https://v2.ocaml.org/manual/polyvariant.html)である必要がある
- 定義がインライン化されていること
- 各 Variant タグは引数を持つ必要がある。
- Variant 型はオープンできない（`>`は使えない）

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

以下のように JavaScript を生成します：

```js
padLeft('Hello World', 4)
padLeft('Hello World', 'Message from Melange: ')
```

[非共有データ型](#non-shared-data-types)のセクションで見たように、JavaScript 側に直接 Variant を渡すのは避けるべきです。`mel.unwrap`を使うことで、Melange から Variant を使うことができ、JavaScript は Variant 内の生の値を得ることができます。

### Using polymorphic variants to bind to enums

JavaScript の API の中には、限られた値のサブセットを入力として受け取るものがあります。例えば、Node の`fs.readFileSync`の第 2 引数は、いくつかの指定された文字列値しか取ることができません：`ascii`、`utf8`などです。他のいくつかの関数は、VS Code API の`createStatusBarItem`関数のように、`alignment`は引数は指定された整数値 [`1` また `2`](https://github.com/Microsoft/vscode/blob/2362ec665c84a1519162b50c36ed4f29d1e20f62/src/vs/vscode.d.ts#L4098-L4109)のみ取ることができます。

これらの引数を単なる`string`や`int`として型付けすることはできますが、JavaScript 関数がサポートしていない値を使って external 関数を呼び出すことを防ぐことはできません。多相 Variant を使って実行時エラーを回避する方法を見てみましょう。

値が文字列の場合、`mel.string` attribute を使用することができます：

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

以下のように JavaScript を生成します:

```js
var Fs = require('fs')
Fs.readFileSync('xx.txt', 'ascii')
```

このテクニックを `mel.as` attribute と組み合わせることで、多相 Variant 値から生成される文字列を変更することができます。例えば：

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

以下のような JavaScript を生成します：

```javascript
var element_style = document.getElementById('my-id').style

element_style.transitionTimingFunction = 'ease-in'
```

Melange は文字列値を生成する以外に、整数値を生成する`mel.int`も提供しています。`mel.int`は`mel.as`と組み合わせることもできます：

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

この例では、`on_closed`は 0 としてエンコードされ、`on_open`は attribute `mel.as`により 20 となり、`in_bin`は 21 となります。なぜなら、Variant タグに`mel.as`アノテーションが与えられていない場合、コンパイラは前の値からカウントアップして値を割り当て続けるからです。

以下のような JavaScript を生成します：

```js
var value = testIntType(20)
```

### Using polymorphic variants to bind to event listeners

Polymorphic Variant は、イベントリスナーや他の種類のコールバックなどをラップするためにも使うことができます：

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

以下のような JavaScript を生成します：

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

JavaScript の関数を呼び出して、引数の 1 つが常に一定であることを確認したいことがあります。この場合、`[@mel.as]` attribute とワイルドカードパターン `_` を組み合わせます：

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

以下のような JavaScript を生成します：

```js
process.on('exit', function (exitCode) {
  console.log('error code: ' + exitCode.toString())
})
```

`mel.as "exit"`とワイルドカードの`_`パターンを組み合わせると、Melange は JavaScript 関数の第 1 引数を`"exit"`という文字列にコンパイルするように指示します。

次のように`mel.as`引用符で囲まれた文字列を渡すことで、任意の JSON リテラルを使用することもできます： `mel.as {json|true|json}` または `mel.as {json|{"name"："John"}|json}`

### Binding to callbacks

OCaml では、すべての関数がとる引数の数（アリティ）は 1 です。つまり、次のような関数を定義すると、アリティは 1 になります：

```ocaml
let add x y = x + y
```

```reasonml
let add = (x, y) => x + y;
```

この関数の型は`int -> int -> int`となります。これは、`add 1`を呼び出すことで`add`を部分的に適用できることを意味し、`add 1`は加算の第 2 引数を期待する別の関数を返します。このような関数は "curried" 関数と呼ばれ、OCaml の currying に関する詳細は "OCaml Programming: Correct + Efficient + Beautiful"の[この章](https://cs3110.github.io/textbook/chapters/hop/currying.html)を参照してください。

これは、すべての関数呼び出しが常にすべての引数を適用するという、JavaScript における関数呼び出しの規約とは相容れないものです。例の続きとして、JavaScript に上のような`add`関数が実装されているとしましょう：

```javascript
var add = function (a, b) {
  return a + b
}
```

`add(1)`を呼び出すと、関数は完全に適用され、`b`の値は`undefined`になります。そして、JavaScript は`1`と`undefined`の値を足そうとするので、結果として`NaN`を得ることになります。

この違いと Melange バインディングへの影響を説明するために、JavaScript 関数のバインディングを次のように書いてみましょう：

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

素朴な external 関数宣言は以下のようになります：

```ocaml
external map : 'a array -> 'b array -> ('a -> 'b -> 'c) -> 'c array = "map"
```

```reasonml
external map: (array('a), array('b), ('a, 'b) => 'c) => array('c) = "map";
```

残念ながら、これは完全には正しくありません。問題はコールバック関数にあり、型は`'a -> 'b -> 'c`です。つまり、`map`は上記の`add`のような関数を期待することになります。しかし、OCaml では、2 つの引数を持つということは、1 つの引数を取る関数を 2 つ持つということなのです。

問題をもう少し明確にするために、`add`を書き換えてみましょう：

```ocaml
let add x = let partial y = x + y in partial
```

```reasonml
let add = x => {
  let partial = y => x + y;
  partial;
};
```

以下のようにコンパイルされます：

```javascript
function add(x) {
  return function (y) {
    return (x + y) | 0
  }
}
```

ここで、もし external 関数`map`を`map arr1 arr2 add`と呼んで`add`関数と一緒に使ったら、期待通りには動かないでしょう。JavaScript の関数の適用は OCaml と同じようにはいかないので、`map`実装の関数呼び出し、`f(a[i],b[i])`は、引数`x`を 1 つしか取らない JavaScript の外部関数`add`に適用され、`b[i]`は捨てられるだけです。この操作から返される値は、2 つの数値の加算ではなく、内側の匿名コールバックとなります。

OCaml と JavaScript の関数とそのアプリケーションの間のこのミスマッチを解決するために、Melange は「uncurried」である必要がある外部関数をアノテートするために使用できる特別な attribute `@u`を提供しています。

Reason 構文では、Reaon のパーサーと深く連携しているため、この attribute は明示的に書く必要はありません。"uncurried"として関数をマークしたい場合、関数の型に`.`を追加します。`('a, 'b) => 'c`の代わりに`(. 'a, 'b) => 'c`と書きます。

上の例では：

```ocaml
external map : 'a array -> 'b array -> (('a -> 'b -> 'c)[@u]) -> 'c array
  = "map"
```

```reasonml
external map: (array('a), array('b), (. 'a, 'b) => 'c) => array('c) = "map";
```

ここで`('a -> 'b -> 'c [@u])`（Reason: `(. 'a, 'b) => 'c`）はアリティ 2 であると解釈されます。一般に、`'a0 -> 'a1 ... 'aN -> 'b0 [@u]`は`'a0 -> 'a1 ... 'aN -> 'b0`と同じですが、前者はアリティが N であることが保証されているのに対し、後者は未知です。

`add`を使って`map`を呼び出そうとすると、次のようになります：

```ocaml
let add x y = x + y
let _ = map [||] [||] add
```

```reasonml
let add = (x, y) => x + y;
let _ = map([||], [||], add);
```

以下ようなエラーが起こります：

```text
let _ = map [||] [||] add
                      ^^^
This expression has type int -> int -> int
but an expression was expected of type ('a -> 'b -> 'c) Js.Fn.arity2
```

これを解決するために、関数定義にも`@u`（Reason: `.`）を追加します：

```ocaml
let add = fun [@u] x y -> x + y
```

```reasonml
let add = (. x, y) => x + y;
```

たくさんの external 関数を書く場合、関数定義の注釈はかなり面倒になります。

この冗長さを回避するために、Melange は`mel.uncurry`という別の attribute を提供しています。

先ほどの例でどのように使えるか見てみましょう。`u`を`mel.uncurry`に置き換えるだけです：

```ocaml
external map :
  'a array -> 'b array -> (('a -> 'b -> 'c)[@mel.uncurry]) -> 'c array = "map"
```

```reasonml
external map:
  (array('a), array('b), [@mel.uncurry] (('a, 'b) => 'c)) => array('c) =
  "map";
```

通常の`add`関数で`map`を呼び出そうとすると、次のようになります：

```ocaml
let add x y = x + y
let _ = map [||] [||] add
```

```reasonml
let add = (x, y) => x + y;
let _ = map([||], [||], add);
```

追加する attribute を追加することなく、すべてがうまく機能するようになりました。

`u`と`mel.uncurry`の主な違いは、後者が external のみで動作することです。`mel.uncurry`はバインディングに使用する推奨オプションであり、`u`はパフォーマンスが重要で、OCaml の関数から生成された JavaScript 関数を部分的に適用しないようにしたい場合に有用です。

### Modeling `this`\-based Callbacks

多くの JavaScript ライブラリには、例えば[`this`キーワード](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)に依存するコールバックがあります：

```js
x.onload = function (v) {
  console.log(this.response + v)
}
```

`x.onload`コールバックの内部では、`this`は`x`を指していることになります。`x.onload`を`unit -> unit`型で宣言するのは正しくありません。その代わりに、Melange は特別な属性`mel.this`を導入しています：

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

以下のような JavaScript を生成します：

```javascript
x.onload = function (v) {
  var o = this
  console.log((o.response + v) | 0)
}
```

第 1 引数は`this`ために予約されることに注意してください。

### Wrapping returned nullable values

JavaScript では`null`と`undefined`は異なるモデルで扱われますが、Melange ではどちらも`'a option`（Reason: `option('a)`）として扱うと便利です。

Melange は null になり得る戻り値の型をバインディング境界でどのようにラップするかをモデル化するために、external の値`mel.return` attribute を認識します。`mel.return`を持つ`external`値は戻り値を`option`型に変換し、`Js.Nullable.toOption`のような関数による余分なラッピング/アンラッピングの必要性を回避します。

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

以下のような JavaScript を生成します：

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

上の`[@mel.return nullable]`（Reason: `[@mel.return nullable]`）のように、`mel.return` attribute は attribute ペイロードを取ります。現在、`null_to_opt`、`undefined_to_opt`、`nullable`、`identity`の 4 つのディレクティブがサポートされています。

`nullable`は、`null`や`undefined`を`option`型に変換するので、推奨されます。

<!-- When the return type is unit: the compiler will append its return value with an OCaml unit literal to make sure it does return unit. Its main purpose is to make the user consume FFI in idiomatic OCaml code, the cost is very very small and the compiler will do smart optimizations to remove it when the returned value is not used (mostly likely). -->

`identity`は、コンパイラが戻り値に対して何もしないようにします。これはほとんど使われませんが、デバッグのために紹介します。

## Generate getters, setters and constructors

[前のセクション](#non-shared-data-types)で見たように、Melange には JavaScript から操作するのが簡単ではない値にコンパイルされる型があります。このような型の値と JavaScript コードからの通信を容易にするために、Melange には変換関数を生成するのに役立つ`deriving` attribute と、これらの型から値を生成する関数が含まれています。特に、Variant と polymorphic variants についてです。

さらに、`deriving`はレコード型で使用することができ、setter や getter、作成関数を生成することができます。

### Variants

#### Creating values

Variant 型の `@deriving` アクセサを使用して、各ブランチのコンストラクタ値を作成します。

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

Melange は各 Variant タグに 1 つの`let`定義を生成し、以下のように実装します：

- ペイロードを持つ Variant タグでは、ペイロード値をパラメータとする関数になります
- ペイロードを持たない Variant タグでは、タグの実行時の値を持つ定数になります
- 上記のアクションタイプ定義に`deriving`のアノテーションを付けると、Melange は以下のようなコードを生成します：

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

コンパイル後の JavaScript コードは以下のようになります：

```javascript
function submit(param_0) {
  return /* Submit */ {
    _0: param_0,
  }
}

var click = /* Click */ 0

var cancel = /* Cancel */ 1
```

生成された定義は小文字であり、JavaScript コードから安全に使用できることに注意してください。例えば、上記の JavaScript で生成されたコードが`generators.js`ファイルにあった場合、定義は次のように使うことができます：

```javascript
const generators = require('./generators.js')

const hello = generators.submit('Hello')
const click = generators.click
```

#### Conversion functions

Variant 型で `@deriving jsConverter` を使うと、JavaScript の整数と Melange の Variant 値を行き来できるコンバータ関数を作成できます。

`@deriving accessors`にはいくつかの違いがあります：

- `jsConverter`は `mel.as` attribute と連動しますが、`accessors` は連動しません
- `jsConverter`はペイロードを持つ Variant タグをサポートしていません
- `jsConverter`は値を前後に変換する関数を生成するが、`accessors`は値を生成する関数を生成します

上記の制約を考慮した上で、jsConverter で動作するように適合させた前の例のバージョンを見てみましょう：

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

これにより、以下の型の関数がいくつか生成されます：

```ocaml
val actionToJs : action -> int

val actionFromJs : int -> action option
```

```reasonml
external actionToJs: action => int = ;

external actionFromJs: int => option(action) = ;
```

`actionToJs`は`action`型の値から整数を返します。これは、多相 Variant で`mel.int`を使うときに説明したのと同じ方法で、`Click`は 0 から始まり、`Submit`は 3（`mel.as`でアノテーションされているため）、そして`Cancel`は 4 となります。

`actionFromJs`は`option`型の値を返しますが、これはすべての整数が`action`型の Variant タグに変換できるわけではないからです。

##### Hide runtime types

型安全性を高めるために、`jsConverter { newType }`のペイロードを`@deriving`で使用することで、生成される関数から Variant（`int`）の実行時表現を隠すことができます：

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

この機能は、JavaScript の実行時表現を隠すために[抽象型](#abstract-types)に依存しています。以下の型を持つ関数を生成します：

```ocaml
val actionToJs : action -> abs_action

val actionFromJs : abs_action -> action
```

```reasonml
external actionToJs: action => abs_action = ;

external actionFromJs: abs_action => action = ;
```

`actionFromJs`の場合、前のケースとは異なり、戻り値は`option`型ではありません。これは "correct by construction"の例であり、`abs_action`を作成する唯一の方法は`actionToJs`関数を呼び出すことです。

### Polymorphic variants

`@deriving jsConverter` attribute は多相 Variant にも適用できます。

> **_NOTE:_** Variant と同様に、`@deriving jsConverter` attribute は Polymorphic Variant タグがペイロードを持っているときは使えません。JavaScript で多相 Variant がどのように表現されるかについては、[実行時の表現](#data-types-and-runtime-representation)のセクションを参照してください。

例を見てみましょう：

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

Variant の例と同様に、以下の 2 つの関数が生成されます：

```ocaml
val actionToJs : action -> string

val actionFromJs : string -> action option
```

```reasonml
external actionToJs: action => string = ;

external actionFromJs: string => option(action) = ;
```

`jsConverter { newType }` ペイロードは多相 Variant でも使用できます。

### Records

#### Accessing fields

レコード型の`@deriving accessors`を使用して、レコード・フィールド名のアクセサ関数を作成します。

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

Melange はレコードに定義されたフィールドごとに関数を生成します。この場合、`pet`型のレコードからそのフィールドを取得できる関数 `name`となります：

<!--#prelude#type pet = { name : string } [@@deriving accessors]-->

```ocaml
let name (param : pet) = param.name
```

```reasonml
let name = (param: pet) => param.name;
```

以上のことを考慮すると、出来上がる JavaScript はこうなります：

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
