const isUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );

const buildMessageSelectedColumns = (messageColumns = {}) => [
  "id",
  messageColumns.senderColumn,
  "conversation_id",
  messageColumns.bodyColumn,
  "created_at",
  ...(messageColumns.imageColumn ? [messageColumns.imageColumn] : []),
  ...(messageColumns.audioColumn ? [messageColumns.audioColumn] : []),
];

const hasSchemaColumnError = (error = null) => {
  const lowerMessage = String(error?.message || "").toLowerCase();
  return (
    lowerMessage.includes("could not find") ||
    lowerMessage.includes("column") ||
    lowerMessage.includes("schema cache")
  );
};

module.exports = {
  isUuid,
  buildMessageSelectedColumns,
  hasSchemaColumnError,
};
