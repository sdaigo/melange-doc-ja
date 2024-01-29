---
title: 'How-to guides'
---

# How-to guides

## Migrate a ReScript library to Melange

既存の [ReScript](https://rescript-lang.org/)（旧 BuckleScript）のコードはほぼそのまま Melange で使用できます。ただし、両プロジェクトは異なる方向に進化しているため、ReScript の最新機能の一部は Melange で動作させるために直接変換することができないかもしれません。

このため、ライブラリの移行は、ReScript の過去のバージョンと互換性のある時期、たとえば v9（または v10 まで）に行うことをお勧めします。

以下はその手順です：

- `opam`ファイルの追加
- `dune-project` ファイルの追加
- `bsconfig.json`ファイルを 1 つまたは複数の `dune` ファイルに置き換える
- (オプション) ReScript 構文から Reason または OCaml 構文への移行
- 全て動作するかを確認：`dune buile`
- 最終ステップ: `bsconfig.json`を削除し、`package.json` にする

詳しく見ていきましょう：

### `opam` ファイルを追加する

ReScript ライブラリを Melange に移行するには、いくつかのパッケージが必要です。Melange は OCaml のパッケージマネージャである[`opam`](https://opam.ocaml.org/)と一緒に使うように設計されています。詳しくは[Package management](./package-management)を参照してください。

ライブラリの移行を始めるために、ライブラリのルートフォルダに`opam`ファイルを作成し、最小限のパッケージ一式を入れてみましょう：

```text
opam-version: "2.0"
synopsis: "My Melange library"
description: "A library for Melange"
maintainer: ["<your_name>"]
authors: ["<your_name>"]
license: "XXX"
homepage: "https://github.com/your/project"
bug-reports: "https://github.com/your/project/issues"
depends: [
  "ocaml"
  "dune"
  "melange"
]
dev-repo: "git+https://github.com/your/project.git"
```

ライブラリが[Reason 構文](https://reasonml.github.io/en/)（`re`ファイル）を使用している場合、依存関係のリストに `"reason"` を追加する必要があります。ライブラリが ReScript 構文（`res`ファイル）を使用している場合は、依存関係のリストに`rescript-syntax`を追加する必要があります。ReScript 構文からの移行方法については、以下のセクションを参照してください。

この時点で、[ローカルの opam switch](https://opam.ocaml.org/blog/opam-local-switches/)を作成して、ライブラリの移行作業を開始できます：

```bash
opam switch create . 5.1.1 -y --deps-only
```

このステップが終わると、`library` フォルダーから`dune`を呼び出すことができますが、その前にいくつかの設定ファイルが必要です。

### `dune-project` ファイルの追加

ライブラリのルートフォルダに `dune-project` という名前のファイルを作成します。このファイルはプロジェクトの設定について Dune にいくつかのことを伝えます：

```text
(lang dune 3.8)

(using melange 0.1)
```

### `bsconfig.json`ファイルを 1 つまたは複数の `dune` ファイルに置き換える

ここで、Dune にライブラリのことを知らせる`dune`ファイルを追加します。この新しいファイルをライブラリのソースの隣に置くと、次のようになります：

```text
(library
 (name things)
 (modes melange)
 (preprocess (pps melange.ppx)))
```

`bsconfig.json` (または `rescript.json`) にある最も一般的な設定が、どのように `dune` ファイルにマッピングされるかを見てみましょう。これらの設定についての詳細は、[Rescript のドキュメント](https://rescript-lang.org/docs/manual/latest/build-configuration)や [Dune のドキュメント](https://dune.readthedocs.io/en/stable/dune-files.html#library)を参照してください。

#### `name`, `namespace`

これら 2 つの設定は `library` stanza の Dune `(wrapped <boolean>)` フィールドに対応します。デフォルトでは、すべての Dune ライブラリはラップされ、ライブラリ名を持つ単一のモジュールがトップレベルで公開されます。そのため、例えば `bsconfig.json` に `"namespace": false` と記述されていた場合、ライブラリに `(wrapped false)` を追加します。

注意すべき点として、ReScript の名前空間と Dune ライブラリでは、命名規則に許容される文字の範囲が異なります。Dune ライブラリ名は、OCaml モジュールに設定されている命名基準に従わなければなりません。例えば、`bsconfig.json` 設定に次のような命名スキームが含まれている場合：

```json
{
  "namespace": "foo-bar"
}
```

以下のように変換する必要があります：

```text
(library
 (name fooBar) # or (name foo_bar)
 (modes melange)
 (preprocess (pps melange.ppx)))
```

#### `sources`

Dune は、ライブラリの一部としてソースフォルダを含めることになると、ReScript とは若干異なる動作をします。

デフォルトでは、Dune は`library` stanza を持つ `dune` ファイルを見つけると、そのフォルダ内のファイルだけをライブラリに含めます（`modules`フィールドが使用されている場合を除く）。複数のサブフォルダーを含むライブラリを作成したい場合は、次のようなスタンザの組み合わせを使用します：

- `(include_subdirs unqualified)`
  ([ドキュメント](https://dune.readthedocs.io/en/stable/dune-files.html#include-subdirs)):
  この stanza は、dune ファイルが存在するフォルダーのすべてのサブフォルダーにあるソースを探すように Dune に指示します
- `(dirs foo bar)`
  ([ドキュメント](https://dune.readthedocs.io/en/stable/dune-files.html#dirs)): この stanza は、現在のフォルダーの `foo` と `bar` のサブディレクトリーだけを調べるように Dune に指示します

例えば、ライブラリの`bsconfig.json`に次のような設定があったとします：

```json
{
  "sources": ["src", "helper"]
}
```

これを次のような構成の`dune`ファイルに変換します：

```text
(include_subdirs unqualified)
(dirs src helper)
(library
 (name things)
 (modes melange)
 (preprocess (pps melange.ppx)))
```

また、場合によっては、`src`と`helper`にそれぞれ別の`dune`ファイルを置き、それぞれに 1 つのライブラリを定義することもできます。その場合、`include_subdirs`と`dirs`は必要ありません。

ReScript の `"type" : "dev"`の設定は、Dune ではパブリックライブラリとプライベートライブラリで解決します。`library` stanza に`public_name`フィールドが含まれていれば、パブリックライブラリになり、インストールされます。そうでない場合はプライベートとなり、パッケージのコンシューマーからは見えなくなります。

#### `bs-dependencies`

ライブラリは他のライブラリに依存している場合があります。`dune`ファイルでライブラリの依存関係を指定するには、`library`stanza の `libraries` フィールドを使用します。

たとえば、`bsconfig.json` に次のような記述があったとします：

```json
"bs-dependencies": [
  "reason-react"
]
```

`dune`ファイルは以下のようになります：

```text
(library
 (name things)
 (libraries reason-react)
 (modes melange)
 (preprocess (pps melange.ppx)))
```

ライブラリの`opam`パッケージにもすべての依存関係を追加しなければならないことを忘れないください。

#### `bs-dev-dependencies`

ほとんどの場合、テストに必要な依存関係を定義するために `bs-dev-dependencies` が使用されます。このシナリオのために、opam は `with-test` 変数を提供しています。

テストに使用する依存関係として`melange-jest`を追加したいとすると、ライブラリの`opam`ファイルに以下を追加します：

```text
depends: [
  "melange-jest" {with-test}
]
```

この変数でマークされたパッケージは、`--with-test` フラグ付きで `opam install` が呼ばれたときに依存関係になります。

ライブラリ`melange-jest`が opam によってインストールされると、Dune で利用できるようになるので、`(libraries melange-jest)`を`libraries`や`melange.emit`stanza に追加するだけで使い始めることができます。

#### `pinned-dependencies`

Dune では monorepo で自然に作業することができるので、依存関係を固定する必要はありません。[パッケージ](<(https://dune.readthedocs.io/en/stable/reference/packages.html)>)は `packages`stanza を使って `dune-project`ファイルで定義することができ、複数の `dune-project` ファイルをひとつのコードベースに追加して monorepo をセットアップして動作させることができます。

#### `external-stdlib`

Melange ではこの機能を直接マッピングすることはできません。この機能に興味がある、または使用例がある場合は、[issue melange-re/melange#620](https://github.com/melange-re/melange/issues/620)で共有してください。

#### `js-post-build`

Dune のルールを使って、いくつかの依存関係がある場合に、いくつかのターゲットを生成するアクションを実行することができます。

例えば、`bsconfig.json`に以下のような記述があったとします：

```json
{
  "js-post-build": {
    "cmd": "node ../../postProcessTheFile.js"
  }
}
```

これを`dune`ファイルで表現すると、次のようになります：

```text
(rule
  (deps (alias melange))
  (action (run node ../../postProcessTheFile.js))
)
```

Dune のルールについて詳しくは、[ドキュメント](https://dune.readthedocs.io/en/stable/dune-files.html#rule)をご覧ください。

#### `package-specs`

この設定はライブラリレベルではなく、アプリケーションレベルで、`melange.emit`stanza の`module_systems`フィールドを使って行います。詳しくは[Build system](./build-system)のセクションを参照してください。

`"in-source"` 設定に関しては、Dune で対応するフィールドは`(promote (until-clean))`設定です。`melange.emit` stanza に追加することができます。詳しくは[Dune のドキュメント](https://dune.readthedocs.io/en/stable/dune-files.html#promote)をご覧ください。

#### `suffix`

`package-specs`と同様、`melange.emit` stanza の`module_system`フィールドでアプリケーションレベルで設定します。[CommonJS や ES6 モジュール](./build-system#commonjs-or-es6-modules)のセクションを参照してください。

#### `warnings` と `bsc-flags`

`library` stanza の[`flags`フィールド](https://dune.readthedocs.io/en/stable/concepts/ocaml-flags.html)を使用して、Melange コンパイラに渡すフラグを定義できます。

Melange のみにフラグを定義したい場合は、`melange.compile_flags`を使用します。

例えば、次のような`bsconfig.json`設定がある場合：

```json
{
  "warnings": {
    "number": "-44-102",
    "error": "+5"
  }
}
```

同様の設定をライブラリの`dune`ファイルに次のように定義できます：

```text
(library
 (name things)
 (modes melange)
 (preprocess (pps melange.ppx))
 (melange.compile_flags :standard -w +5-44-102))
```

`bsc-flags` も同様です。

### (オプション) ReScript 構文から Reason または OCaml 構文への移行

The package `rescript-syntax` allows to translate `res` source files to `ml`.

To use this package, we need to install it first:

```bash
opam install rescript-syntax
```

> Note that the `rescript-syntax` package is only compatible with the version 1
> of `melange`, so if you are using a more recent version of `melange`, you
> might need to downgrade it before installing `rescript-syntax`.

To convert a `res` file to `ml` syntax:

```bash
rescript_syntax myFile.res -print ml > myFile.ml
```

You can use this command in combination with `find` to convert multiple files at
once:

```bash
find src1 src2 -type f -name "*.res" -exec echo "rescript_syntax {} -print ml" \;
```

If you want to convert the files to Reason syntax (`re`), you can pipe the
output of each file to `refmt`.

```bash
rescript_syntax ./myFile.res -print ml | refmt --parse=ml --print re > myFile.re
```

Note that `refmt` is available in the `reason` package, so if your library
modules are written using Reason syntax, remember to install it first using
`opam install reason` before performing the conversion, and also adding it to
your library `opam` file as well.

### Make sure everything works: `dune build`

Once you have performed the above steps, you can test that everything works by
running

```bash
dune build
```

Throughout the process, you might run into some errors, these are the most
common ones:

#### Warning 16 [unerasable-opt-argument] is triggered more often than before

Melange triggers `Warning 16: this optional argument cannot be erased` more
often than before, as the type system in OCaml 4.12 was improved. You can read
more about this in this [OCaml PR](https://github.com/ocaml/ocaml/pull/9783).

**Fix**: either add `()` as final param of the function, or replace one labelled
arg with a positional one.

#### Warning 69 [unused-field] triggered from bindings types

Sometimes, types for bindings will trigger `Warning 69 [unused-field]: record
field foo is never read.` errors.

**Fix**: silence the warning in the type definition, e.g.

```ocaml
type renderOptions = {
  foo : string
} [@@warning "-69"]
```

#### Destructuring order is changed

Destructuring in `let` patterns in Melange is done on the left side first, while
on ReScript is done on the right side first. You can read more in the [Melange
PR](https://github.com/melange-re/melange/pull/161) with the explanation.

**Fix**: move module namespacing to the left side of the `let` expressions.

#### `Pervasives` is deprecated

This is also another change due to OCaml compiler moving forward.

**Fix**: Use `Stdlib` instead.

#### Runtime assets are missing

In ReScript, building in source is very common. In Melange and Dune, the most
common setup is having all artifacts inside the `_build` folder. If your library
is using some asset such as:

```ocaml
external myImage : string = "default" [@@bs.module "./icons/overview.svg"]
```

**Fix**: You can include it by using the `melange.runtime_deps` field of the
library:

```text
(library
 (name things)
 (modes melange)
 (preprocess (pps melange.ppx))
 (melange.runtime_deps icons/overview.svg))
```

You can read more about this in the [Handling
assets](./build-system.md#handling-assets) section.

### Final step: remove `bsconfig.json` and adapt `package.json`

If everything went well, you can remove the `bsconfig.json` file, and remove any
dependencies needed by Melange from the `package.json`, as they will be
appearing in the `opam` file instead, as it was mentioned in the
[`bs-dependencies` section](#bs-dependencies).

## Migrate

This section contains information about migrating from older versions of Melange
to newer ones.

### To v2 from v1

Melange v2 is only compatible with OCaml 5.1. In order to upgrade, let's update
the local opam switch first, to make sure the local repository gets the versions
v2 of Melange and 5.1 of OCaml:

```bash
opam update
```

Now, update the version of the OCaml compiler in the local switch to 5.1:

```bash
opam install --update-invariant ocaml-base-compiler.5.1.1
```

Finally, we can upgrade all packages to get Melange v2 and the latest version of
all libraries:

```bash
opam upgrade
```

To make sure you have the latest version of Melange, you can use the `opam list`
subcommand:

```bash
opam list --installed melange
# Packages matching: name-match(melange) & installed
# Name  # Installed    # Synopsis
melange 2.2.0          Toolchain to produce JS from Reason/OCaml
```

Before building, we have to update some parts of the configuration to make it
work with v2.

#### `melange.ppx` now includes most syntax transformations

Most of the attributes used to write bindings are now handled by `melange.ppx`.
If you get errors of the kind `Unused attribute`, or type errors in externals
that don't make much sense, then you probably need to add `melange.ppx` to your
`library` or ` melange.emit` stanzas.

```
(library
 ...
 (preprocess
  (pps melange.ppx)))
```

#### Warnings have been turned into alerts

Some warnings were turned into alerts, so they might be visible even if using
`vendored_dirs`. To silence these alerts, either fix the root cause or silence
them using `(preprocess (pps melange.ppx -alert -deprecated))`.

#### Wrapped libraries

Melange libraries like Belt and Js are now wrapped, so the access to modules
inside them need to be adapted. Some examples:

- `Js_string` needs to be replaced with `Js.String`
- `Belt_MapInt` is now `Belt.Map.Int`

#### Changes in `deriving`

The `bs.deriving` attribute is replaced with `deriving`. Also, the payload taken
by this attribute has been adapted to conform to ppxlib requirements. Note that
`mel.deriving` is not accepted.

Let's see how the payload has changed in both OCaml and Reason syntaxes.

In Ocaml syntax:

| Before                                        | After                                      |
| --------------------------------------------- | ------------------------------------------ |
| `[@@bs.deriving { jsConverter =  newType  }]` | `[@@deriving  jsConverter {  newType }  ]` |
| `[@@bs.deriving { abstract = light }]`        | `[@@deriving abstract { light }]`          |

In Reason syntax:

| Before                                  | After                                         |
| --------------------------------------- | --------------------------------------------- |
| `[@bs.deriving {jsConverter: newType}]` | `[@deriving jsConverter({newType: newType})]` |
| `[@bs.deriving {abstract: light}]`      | `[@deriving abstract({light: light})]`        |

#### `bs.*` attributes and extensions become `mel.*`

All attributes or extension nodes prefixed with `bs` are now prefixed with `mel`
instead.

For example `@bs.as` becomes `@mel.as`, and `%bs.raw` becomes `%mel.raw`.

Note that attributes in the deprecated form (`@bs.*`) are still accepted until
v3, but node extensions (`%bs.*`) are not.

#### `@bs` attribute becomes `@u`

The `@bs` attribute, used for uncurried application (see the ["Binding to
callbacks" section](./communicate-with-javascript.md#binding-to-callbacks)),
becomes `@u`.

#### `@bs.val` is gone

The `@bs.val` attribute is no longer necessary, and can be removed from
`external` definitions. See more information in the ["Using global functions or
values"](./communicate-with-javascript.md#using-global-functions-or-values)
section.

#### `Dom` and `Node` are in their own libraries

The namespaces `Dom` and `Node` are now in the libraries `melange.dom` and
`melange.node` respectively. These libraries are not included by default by
Melange, and will need to be added to the `libraries` field explicitly.

#### Effect handlers

Although Melange v2 requires OCaml 5.1, it doesn't yet provide a good solution
for compiling effect handlers to JavaScript. Until it does, they are disabled at
the compiler level, and their APIs are not accessible.
