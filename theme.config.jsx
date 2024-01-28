import { useConfig } from 'nextra-theme-docs'

export default {
  head: () => {
    const { frontMatter } = useConfig()
    console.log(frontMatter.title)
    return (
      <>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charSet="utf-8" />
        <title>{frontMatter.title} Melange</title>
        <meta property="og:title" content="Melange doc Japanese" />
        <meta
          property="og:description"
          content="OCaml for JavaScript developers"
        />
      </>
    )
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s | Melange',
    }
  },
  logo: (
    <strong>
      Melange <small>v2.2.0</small>
    </strong>
  ),
  project: {
    link: 'https://github.com/sdaigo/melange-doc-ja',
  },
  footer: {
    text: (
      <span>
        <a href="https://melange.re/" target="_blank">
          Melange Home
        </a>
      </span>
    ),
  },
}
