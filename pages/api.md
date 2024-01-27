# API

Melange は 3 つのライブラリを公開している：

- A standard library, which mostly replicates that of OCaml for compatibility:
  the <a class="text-ocaml" href="../api/ml/melange/Stdlib"><code>Stdlib</code>
  library</a><a class="text-reasonml"
  href="../api/re/melange/Stdlib"><code>Stdlib</code> library</a>
- Bindings to several browser and Node JavaScript APIs in the <a
  class="text-ocaml" href="../api/ml/melange/Js"><code>Js</code> library</a><a
  class="text-reasonml" href="../api/re/melange/Js"><code>Js</code> library</a>
- Data structures and collection types in the <a class="text-ocaml"
  href="../api/ml/melange/Belt"><code>Belt</code> library</a><a
  class="text-reasonml" href="../api/re/melange/Belt"><code>Belt</code>
  library</a>

Using one or the other will depend on your application requirements, how much
integration you need with existing JavaScript libraries, or other specific
characteristics of your project. In any case, the three of them can be used in
the same project without issues.
