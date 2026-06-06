export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  "Debe tener mínimo 8 caracteres, una minúscula, una mayúscula, un número y un carácter especial";
