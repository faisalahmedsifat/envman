export class EnvmanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvmanError";
  }
}
