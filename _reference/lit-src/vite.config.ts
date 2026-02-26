import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

function mockApiPlugin(): Plugin {
  const MOCK_INVOICE = {
    invoice: {
      id: "491b4e8e-26f4-45fb-8d86-c7c27dd291b0",
      order_id: "ORD-2024-0042",
      asset_id: "polygon:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      asset_name: "USDC",
      chain: "polygon",
      amount: "25.50",
      payment_address: "0x2c1d4e0FB7fe91247C4025A4a97694ed7c3BB8CA",
      redirect_url: "https://example.com/thank-you",
      status: "Waiting",
      cart: {
        items: [
          {
            name: "Premium Widget",
            quantity: 1,
            price: "15.00",
            image_url: "https://api.dicebear.com/7.x/shapes/svg?seed=widget1",
          },
          {
            name: "Basic Gadget",
            quantity: 2,
            price: "5.25",
            image_url: "https://api.dicebear.com/7.x/shapes/svg?seed=gadget2",
          },
        ],
      },
      valid_till: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    total_received_amount: "0",
  };

  let mockInvoiceStatus = "Waiting";

  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Control endpoint: POST /__mock/invoice-status?status=Paid
        if (req.url?.startsWith("/__mock/invoice-status")) {
          const url = new URL(req.url, "http://localhost");
          mockInvoiceStatus = url.searchParams.get("status") ?? "Waiting";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: mockInvoiceStatus }));
          return;
        }
        if (req.url?.startsWith("/public/invoice")) {
          const response = {
            ...MOCK_INVOICE,
            invoice: { ...MOCK_INVOICE.invoice, status: mockInvoiceStatus },
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(response));
          return;
        }
        if (req.url?.startsWith("/public/swap/register") && req.method === "POST") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const useMocks = !isProduction && process.env.VITE_MOCK !== "false";

  return {
    base: isProduction ? "/public/assets/" : "/",
    plugins: [
      ...(useMocks ? [mockApiPlugin()] : []),
    ],
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
      sourcemap: isProduction ? false : "inline",
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
        "/public/invoice": {
          target: "http://localhost:8080",
        },
        "/public/swap": {
          target: "http://localhost:8080",
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
