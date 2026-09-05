import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Barbearia Maraca API',
      version: '1.0.0',
      description: 'API REST da barbearia',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [
    path.join(__dirname, 'src', 'server.ts'),
    path.join(__dirname, 'src', 'rotas', 'auth-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'servico-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'cliente-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'funcionario-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'agendamento-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'horario-routes.ts'),
  ],
};

const spec = swaggerJSDoc(options);
const output = path.join(__dirname, 'openapi.json');
fs.writeFileSync(output, JSON.stringify(spec, null, 2));
console.log(`Spec gerado em ${output}`);