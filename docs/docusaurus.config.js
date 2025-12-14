// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Relay',
  tagline: 'Gateway de comunicación en tiempo real',
  favicon: 'img/favicon.ico',

  // URL y baseUrl para relay.coderic.net
  url: 'https://relay.coderic.net',
  baseUrl: '/',
  organizationName: 'Coderic',
  projectName: 'Relay',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Coderic/Relay/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/relay-social.png',
      navbar: {
        title: 'Relay',
        logo: {
          alt: 'Relay Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentación',
          },
          {
            href: 'https://github.com/Coderic/Relay',
            label: 'GitHub',
            position: 'right',
          },
        ],
        hideOnScroll: false,
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentación',
            items: [
              {
                label: 'Introducción',
                to: '/docs/intro',
              },
              {
                label: 'API',
                to: '/docs/api',
              },
              {
                label: 'Ejemplos',
                to: '/docs/ejemplos',
              },
            ],
          },
          {
            title: 'Comunidad',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/Coderic/Relay',
              },
              {
                label: 'Issues',
                href: 'https://github.com/Coderic/Relay/issues',
              },
            ],
          },
          {
            title: 'Más',
            items: [
              {
                label: 'Releases',
                href: 'https://github.com/Coderic/Relay/releases',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Coderic. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['bash', 'json'],
      },
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
        disableSwitch: false,
      },
    }),
};

module.exports = config;

