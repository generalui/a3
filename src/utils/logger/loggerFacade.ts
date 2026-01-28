export interface LoggerFacade {
  log(level: string, message: string, meta?: object): void
}
