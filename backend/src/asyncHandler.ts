import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 no reenvía rechazos de promesas a next() automáticamente:
// un error sin capturar en un handler async se vuelve un unhandled
// rejection y tumba el proceso completo. Este wrapper lo evita.
export function ah<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}
