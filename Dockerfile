FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
