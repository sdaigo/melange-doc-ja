import { useConfig } from 'nextra-theme-docs'
import { useRouter } from 'next/router'

export default {
  docsRepositoryBase: 'https://github.com/sdaigo/melange-doc-ja/blob/main',
  useNextSeoProps() {
    const { frontMatter } = useConfig()
    return {
      titleTemplate: '%s | Melange',
      additionalMetaTags: [
        { content: 'ja', httpEquiv: 'Content-Language' },
        { content: 'Melange', name: 'apple-mobile-web-app-title' },
        { content: 'OCaml for JavaScript developers', name: 'description' },
      ],
      description:
        frontMatter.description || 'Melange - Ocaml for JavaScript developers',
    }
  },
  head: () => {
    const { asPath, defaultLocale, locale } = useRouter()
    const { frontMatter } = useConfig()
    const url =
      'https://melange-doc-ja.vercel.app' +
      (defaultLocale === locale ? asPath : `/${locale}${asPath}`)

    return (
      <>
        <meta property="og:url" content={url} />
        <meta property="og:title" content={frontMatter.title || 'Melange'} />
        <meta
          property="og:description"
          content={frontMatter.description || 'Melange'}
        />
      </>
    )
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{ display: 'flex', alignItems: 'flex-end', gap: '0.1rem' }}
            >
              <small>
                Built with{' '}
                <a
                  href="https://nextra.site/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="nextra.site"
                >
                  Nextra
                </a>
              </small>
              <svg
                width="16"
                height="16"
                viewBox="0 0 144 144"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_510_6)">
                  <path
                    d="M108.411 31.0308L104.919 34.523C86.9284 52.5134 57.7601 52.5134 39.7697 34.523L36.2775 31.0308C34.8287 29.582 32.4797 29.582 31.0309 31.0308C29.5821 32.4796 29.5821 34.8286 31.0309 36.2773L34.5231 39.7695C52.5135 57.76 52.5135 86.9283 34.5231 104.919L31.0309 108.411C29.5821 109.86 29.5821 112.209 31.0309 113.657C32.4797 115.106 34.8287 115.106 36.2775 113.657L39.7697 110.165C57.7601 92.1748 86.9284 92.1748 104.919 110.165L108.411 113.657C109.86 115.106 112.209 115.106 113.658 113.657C115.106 112.209 115.106 109.86 113.658 108.411L110.165 104.919C92.1749 86.9283 92.1749 57.76 110.165 39.7695L113.658 36.2773C115.106 34.8286 115.106 32.4796 113.658 31.0308C112.209 29.582 109.86 29.582 108.411 31.0308Z"
                    fill="black"
                    stroke="black"
                    strokeWidth="4"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_510_6">
                    <rect width="144" height="144" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </span>
            <small> and </small>
            <span>
              <a
                target="_blank"
                rel="noopener noreferrer"
                title="vercel.com"
                href="https://vercel.com"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                }}
              >
                <small>Powered by</small>
                <svg height={16} viewBox="0 0 283 64" fill="none">
                  <title>Vercel</title>
                  <path
                    fill="currentColor"
                    d="M141.04 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM248.72 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM200.24 34c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9V5h9zM36.95 0L73.9 64H0L36.95 0zm92.38 5l-27.71 48L73.91 5H84.3l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10V51h-9V17h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"
                  />
                </svg>
              </a>
            </span>
          </p>
          <a href="https://melange.re/" target="_blank">
            <small>&copy; Melange</small>
          </a>
        </div>
      </div>
    ),
  },
  toc: {
    backToTop: true,
  },
  editLink: {
    text: 'Edit this page on GitHub →',
  },
}
