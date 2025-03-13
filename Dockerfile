FROM node:22

# Install Chromium dependencies
# RUN apt-get update && apt-get install -y \
#   chromium \
#   fonts-ipafont-gothic \
#   fonts-wqy-zenhei \
#   fonts-thai-tlwg \
#   fonts-kacst \
#   fonts-symbola \
#   --no-install-recommends && \
#   apt-get clean && rm -rf /var/lib/apt/lists/*
# RUN apt-get update && apt-get install -y \
#   xz-utils \
#   bzip2 \
#   curl \
#   && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y \
  # chromium \
  xz-utils \
  bzip2 \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  curl \
  && apt-get clean && rm -rf /var/lib/apt/lists/*


# Install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN rm -rf node_modules package-lock.json




# Set ENV agar Puppeteer menemukan Chromium
# ENV PUPPETEER_EXECUTABLE_PATH=/app/node_modules/puppeteer/.local-chromium/linux-*/chrome-linux64/chrome
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN npm install
RUN npm cache clean --force

# Install Chromium menggunakan @puppeteer/browsers
RUN npx @puppeteer/browsers install chrome@stable 

# Copy kode aplikasi
COPY . .

CMD ["node", "bot.js"]
