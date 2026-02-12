import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
        output: {
          entryFileNames: "payment-page.js",
          assetFileNames: "payment-page.[ext]",
          inlineDynamicImports: true,
          compact: true,
          generatedCode: {
            constBindings: true,
            objectShorthand: true,
          },
        },
        external: [],
        treeshake: {
          moduleSideEffects: () => true,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
      },
      minify: isProduction ? "terser" : false,
      terserOptions: isProduction
        ? {
          compress: {
            drop_console: true,
            drop_debugger: true,
            passes: 2,
            dead_code: true,
            unused: true,
            conditionals: true,
            evaluate: true,
            booleans: true,
            loops: true,
            properties: true,
            inline: 2,
            reduce_vars: true,
            join_vars: true,
            collapse_vars: true,
          },
          mangle: {
            properties: false,
            toplevel: true,
            safari10: true,
          },
          format: {
            comments: false,
            ecma: 2020,
            safari10: true,
          },
          keep_classnames: false,
          keep_fnames: false,
        }
        : undefined,
      sourcemap: isProduction ? true : "inline",
      target: "es2020",
      chunkSizeWarningLimit: 500,
      reportCompressedSize: true,
      cssCodeSplit: false,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
      dedupe: ["lit", "lit-element", "lit-html", "lit-html/directives"],
    },
    css: {
      postcss: "./postcss.config.mjs",
      devSourcemap: !isProduction,
    },
    optimizeDeps: {
      include: ["lit"],
    },
    server: {
      port: 3001,
      open: false,
      cors: true,
      proxy: {
        "/invoice": {
          target: "http://localhost:8080",
          rewrite: (path) => `/public${path}`,
        },
        "/swap": {
          target: "http://localhost:8080",
          rewrite: (path) => `/public${path}`,
        },
      },
    },
    preview: {
      port: 4174,
      cors: true,
    },
    esbuild: {
      legalComments: "none",
      treeShaking: true,
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
    },
  };
});
