import { Router } from "express";
import multer from "multer";
import { supabase } from "../supabase";
import { subirLogo } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const miEmpresaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Formato de imagen no soportado (usa jpeg, png o webp)"));
      return;
    }
    cb(null, true);
  },
});

miEmpresaRouter.post(
  "/logo",
  upload.single("logo"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol !== "admin") {
      res.status(403).json({ error: "Solo un admin puede cambiar el logo" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'logo')" });
      return;
    }

    const logoUrl = await subirLogo(req.empresaId!, req.file.buffer, req.file.mimetype);

    const { data, error } = await supabase
      .from("empresas")
      .update({ logo_url: logoUrl })
      .eq("id", req.empresaId!)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);
