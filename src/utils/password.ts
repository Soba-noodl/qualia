/** Password rules used on sign-up and reset password. */
export const PASSWORD_MIN_LENGTH = 8;

export function checkPasswordConstraints(password: string) {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const c = checkPasswordConstraints(password);
  return c.minLength && c.hasUppercase && c.hasLowercase && c.hasNumber;
}
