# Deploy na VPS - pregadores.site

Este guia sobe o projeto Next.js em producao com PM2 + Nginx + SSL para `www.pregadores.site`.

## 1) Preparar servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2) Publicar codigo

```bash
sudo mkdir -p /var/www/pregadores
sudo chown -R $USER:$USER /var/www/pregadores
git clone <SEU_REPOSITORIO_GIT> /var/www/pregadores
cd /var/www/pregadores
npm ci
```

## 3) Configurar ambiente

```bash
cp .env.production.example .env.production
nano .env.production
```

Preencha obrigatoriamente:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (se usar mapa Google em producao)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend do botao Google)
- `GOOGLE_CLIENT_ID` (backend para validar token Google)

## 3.1) Confirmar que a VPS esta em PostgreSQL

Valide o valor carregado em runtime:

```bash
cd /var/www/pregadores
grep DATABASE_URL .env.production
```

O valor deve comecar com `postgresql://` ou `postgres://`.

Importante:
- Em producao, o Next.js usa `.env.production` (e depois `.env` como fallback)
- Se `.env.production` estiver correto com Postgres, ele prevalece sobre `.env`
- Se faltar `DATABASE_URL` valida, a aplicacao agora falha no boot em producao (fail fast)

Teste rapido de conexao apos subir a app:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/auth/login
pm2 logs pregadores-web --lines 100
```

Se aparecer erro de banco, revise imediatamente `DATABASE_URL` em `.env.production`.

## 4) Migrar banco e build

```bash
npm run db:migrate:deploy
npm run build
```

## 5) Subir com PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Teste local interno:

```bash
curl -I http://127.0.0.1:3000
```

## 6) Nginx para www.pregadores.site

Crie `/etc/nginx/sites-available/pregadores.site`:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name pregadores.site www.pregadores.site;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/pregadores.site /etc/nginx/sites-enabled/pregadores.site
sudo nginx -t
sudo systemctl reload nginx
```

## 7) SSL com Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pregadores.site -d www.pregadores.site
```

## 8) DNS

No provedor DNS:
- Registre `A` para `pregadores.site` apontando para o IP da VPS
- Registre `A` para `www.pregadores.site` apontando para o IP da VPS

## 9) Operacao do dia a dia

Atualizacao automatizada (recomendado):

```bash
cd /var/www/pregadores
chmod +x atualizar-vps.sh
./atualizar-vps.sh
```

Variaveis opcionais:

```bash
APP_DIR=/var/www/pregadores BRANCH=main PM2_APP=pregadores-web RUN_MIGRATE=1 ./atualizar-vps.sh
```

Atualizar deploy:

```bash
cd /var/www/pregadores
git pull
npm ci
npm run db:migrate:deploy
npm run build
pm2 restart pregadores-web
```

Logs:

```bash
pm2 logs pregadores-web
```

## Checklist rapido

- `.env.production` preenchido com segredos fortes
- Banco acessivel a partir da VPS
- Build concluido sem erro
- PM2 com app online
- Nginx ativo e SSL emitido
