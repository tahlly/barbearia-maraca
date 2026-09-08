import nodemailer, { type Transporter } from 'nodemailer';
import { LOGO_EMAIL_DATA_URI } from '../utils/email-logo';

let transporter: Transporter | null = null;

const RESET_TOKEN_TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MIN) || 30;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

/** Escapa texto para uso seguro dentro de HTML (atributos e conteúdo). */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function montarHtmlRecuperacaoSenha(link: string): string {
  const logoUrl = LOGO_EMAIL_DATA_URI;
  const linkSeguro = escaparHtml(link);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Recuperação de senha — Barbearia Maracá</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121214; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #121214;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table
          role="presentation"
          width="520"
          cellpadding="0"
          cellspacing="0"
          style="max-width: 520px; width: 100%; background-color: #1e1e22; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 16px;"
        >
          <!-- Cabeçalho com a marca -->
          <tr>
            <td align="center" style="padding: 24px 24px 6px;">
              <img
                src="${logoUrl}"
                alt="Barbearia Maracá"
                width="96"
                style="display: block; width: 96px; height: auto; margin: 0 auto; border: 0; outline: none; text-decoration: none;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 4px 24px 14px;">
              <p style="margin: 0; font-size: 17px; font-weight: 700; letter-spacing: 4px; color: #d4af37; text-transform: uppercase;">
                Barbearia Maracá
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid rgba(212, 175, 55, 0.4); height: 1px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Conteúdo -->
          <tr>
            <td style="padding: 24px 24px 4px;">
              <h1 style="margin: 0 0 10px; font-size: 21px; line-height: 1.3; font-weight: 700; color: #ffffff;">
                Recuperação de senha
              </h1>
              <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #9a9aa5;">
                Recebemos uma solicitação para redefinir sua senha. Se não foi você, pode ignorar este e-mail com segurança.
              </p>
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #d4af37;">
                    <a
                      href="${linkSeguro}"
                      target="_blank"
                      rel="noopener"
                      style="display: inline-block; padding: 12px 32px; font-size: 14px; font-weight: 700; color: #121214; text-decoration: none; border-radius: 8px; background-color: #d4af37;"
                    >Redefinir senha</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 18px; font-size: 12px; line-height: 1.6; color: #9a9aa5; text-align: center; word-break: break-all;">
                Se o botão não aparecer, copie e cole o link no navegador:<br />
                <a href="${linkSeguro}" style="color: #d4af37; text-decoration: underline;">${linkSeguro}</a>
              </p>
            </td>
          </tr>
          <!-- Aviso de expiração -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td
                    align="center"
                    style="background-color: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 8px; padding: 10px 14px;"
                  >
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #e2c252;">
                      Este link expira em ${RESET_TOKEN_TTL_MIN} minutos.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid rgba(212, 175, 55, 0.4); height: 1px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Rodapé -->
          <tr>
            <td align="center" style="padding: 16px 24px 24px;">
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #ffffff;">Barbearia Maracá</p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9a9aa5;">
                Se você não solicitou esta redefinição, ignore este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function montarTextoRecuperacaoSenha(link: string): string {
  return `Barbearia Maracá
Recuperação de senha

Recebemos uma solicitação para redefinir sua senha. Se não foi você, pode ignorar este e-mail com segurança.

Para redefinir sua senha, acesse o link abaixo:
${link}

Este link expira em ${RESET_TOKEN_TTL_MIN} minutos.

Se você não solicitou esta redefinição, ignore este e-mail.`;
}

export async function enviarEmailRecuperacaoSenha(
  destinatario: string,
  link: string,
): Promise<void> {
  const from = process.env.SMTP_FROM || 'no-reply@barbeariamaraca.com';
  await getTransporter().sendMail({
    from,
    to: destinatario,
    subject: 'Recuperação de senha — Barbearia Maracá',
    text: montarTextoRecuperacaoSenha(link),
    html: montarHtmlRecuperacaoSenha(link),
  });
}
