import { useConfig } from 'nextra-theme-docs'

export default {
  head: () => {
    const { frontMatter } = useConfig()
    return (
      <>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="OCaml for JavaScript developers" />
        <title>
          {frontMatter.title ? `${frontMatter.title} | Melange` : 'Melange'}
        </title>
        <meta property="og:title" content="OCaml for JavaScript developers" />
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
