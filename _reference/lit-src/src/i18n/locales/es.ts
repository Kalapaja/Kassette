import type { en } from "./en.ts";

export const es: Record<keyof typeof en, string> = {
  "order.badge": "PEDIDO {id}",
  "merchant.pay": "Pagar a {name}",

  "order.yourOrder": "Tu pedido",
  "order.shipping": "Envio",
  "order.total": "Total",

  "button.pay": "Pagar",
  "button.connectAndPay": "Conectar billetera y pagar",

  "footer.poweredBy": "Desarrollado por",

  "sheet.payWith": "Pagar con",
  "sheet.findToken": "Buscar token",
  "sheet.search": "Buscar",
  "sheet.availableBalance": "Saldo disponible",
  "sheet.exchangeRate": "Tasa de cambio",

  "sheet.button.success": "Pago exitoso",
  "sheet.button.tryAgain": "Intentar de nuevo",
  "sheet.button.updatingRate": "Actualizando tasa",
  "sheet.button.selectToken": "Seleccionar token para pagar",

  "fees.exchange": "Cambio",
  "fees.gasFee": "Comision de gas",
  "fees.loading": "Cargando comisiones...",
  "fees.gasDepends": "La comision de gas depende del token seleccionado",

  "transaction.viewOn": "Ver transaccion en {explorer}",

  "redirect.message": "Redirigiendo a la pagina del recibo...",

  "loading.invoice": "Cargando factura...",
  "error.invoiceDefault": "Error de factura",
  "error.invoiceStatus": "La factura esta {status}",
  "error.loadInvoice": "Error al cargar la factura",
  "error.switchNetwork": "Error al cambiar de red",
  "error.paymentFailed": "El pago fallo",
  "error.getQuote": "Error al obtener cotizacion",
  "error.invoiceExpired": "La factura ha expirado",
  "error.partialPayment":
    "Pago parcial recibido. Por favor, contacte soporte.",

  "aria.disconnectWallet": "Desconectar billetera",
  "aria.searchTokens": "Buscar tokens",
  "aria.clearSearch": "Limpiar busqueda",
  "aria.processingPayment": "Procesando pago",
  "aria.updatingRate": "Actualizando tasa",
  "aria.successfulPayment": "Pago exitoso",
  "aria.bottomSheet": "Panel inferior",
  "aria.selectOption": "Seleccionar una opcion",
  "aria.colorMode": "Modo de color",
  "aria.lightMode": "Modo claro",
  "aria.darkMode": "Modo oscuro",
  "aria.balance": "saldo",
  "aria.value": "valor",
  "aria.languageSwitcher": "Idioma",

  "recovery.pendingFound": "Se encontro un intento de pago anterior",
  "recovery.doubleChargeWarning": "Iniciar un nuevo pago mientras esta transaccion esta pendiente puede resultar en un doble cobro.",
  "recovery.speedUp": "Acelerar",
  "recovery.speedingUp": "Acelerando...",
  "recovery.dismiss": "Descartar y reintentar",
  "recovery.connectWallet": "Conecta la billetera que envio la transaccion original",
  "recovery.wrongWallet": "La billetera conectada no coincide con el remitente original",
  "recovery.txNotFound": "Transaccion no encontrada en la cadena",
  "recovery.speedUpFailed": "La aceleracion fallo. Intenta desde tu billetera.",
  "recovery.justNow": "justo ahora",
  "recovery.minutesAgo": "hace {count}m",
  "recovery.hoursAgo": "hace {count}h",

  "select.placeholder": "Seleccionar",
};
