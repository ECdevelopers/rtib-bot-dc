import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import puppeteer from 'puppeteer-core';
import http from "http";

// Konfigurasi dotenv
const TOKEN = process.env.DISCORD_SECRET_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const REQUIRED_ROLE_ID = process.env.DISCORD_ROLE_ID;

const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;
const ATERNOST_URL = process.env.ATERNOS_URL;

const SERVER_MINECRAFT_URL = process.env.SERVER_MINECRAFT_URL;
const SERVER_MINECRAFT_IMAGE_INFO = process.env.SERVER_MINECRAFT_IMAGE_INFO;
const SERVER_MINECRAFT_PORT = process.env.SERVER_MINECRAFT_PORT;
const SERVER_MINECRAFT_ADDRES = process.env.SERVER_MINECRAFT_ADDRES;

const PUPPERTER_BRWSER = process.env.PUPPERTER_BRWSER;



const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let browser = null;
let page = null;

bot.once("ready", async () => {
  console.log(`🔥 Bot ${bot.user.tag} sudah online!`);
  await registerCommands();
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("start-minecraft").setDescription("Menyalakan server Minecraft Aternos"),
    new SlashCommandBuilder().setName("status-minecraft").setDescription("Cek status server Minecraft"),
    new SlashCommandBuilder().setName("info-server-minecraft").setDescription("Menampilkan informasi Server minecraft"),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(bot.user.id, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

// ✅ Cek apakah user ada di server & punya role tertentu
async function checkUserInGuild(userId) {
  try {
    const guild = await bot.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    if (!member) return false; // User tidak ada di server

    // Cek apakah user punya role yang dibutuhkan
    const hasRole = member.roles.cache.has(REQUIRED_ROLE_ID);
    return hasRole;
  } catch (error) {
    console.error("⚠️ Error saat cek user di server:", error);
    return false;
  }
}


bot.on("messageCreate", async (message) => {
  if (message.content.startsWith("!cekuser")) {
    const args = message.content.split(" ");
    if (args.length < 2) {
      return message.reply("⚠️ Gunakan format: `!cekuser <user_id>`");
    }

    const userId = args[1];
    const isMember = await checkUserInGuild(userId);

    if (isMember) {
      message.reply(`✅ User <@${userId}> ada di server dan memiliki role yang diperlukan.`);
    } else {
      message.reply(`❌ User <@${userId}> tidak ada di server atau tidak memiliki role.`);
    }
  }
});

// ✅ Perintah "!ping"
bot.on("messageCreate", (message) => {
  if (message.content === "!ping") {
    message.reply("Pong! 🏓");
  }
});

// ✅ Event saat ada member baru join
bot.on("guildMemberAdd", (member) => {
  console.log(`👋 ${member.user.tag} baru saja join ke server!`);
});


async function startAternosServer(interaction) {
  try {
    await interaction.editReply("⏳ Memulai server Minecraft...");

    if (!browser || !page) {
      console.log("🌐 Meluncurkan ulang browser...");
       browser = await puppeteer.launch({
        headless: false,
        executablePath: PUPPERTER_BRWSER,
        userDataDir: "./user_data",
        args: ["--no-sandbox", "--disable-setuid-sandbox","--disable-blink-features=AutomationControlled","--disable-features=site-per-process",
        "--disable-web-security"],
      });
      
      page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36");
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
    }

    await page.goto(ATERNOST_URL, { waitUntil: "networkidle2", timeout: 0 });

    // if (!(await page.$(".server-body"))) {
    //   await page.type("input.username", ATERNOS_USER);
    //   await page.type("input.password", ATERNOS_PASS);
    //   await page.click("button.login-button.btn.btn-main.join-left");
      await page.waitForSelector(".server-body", { timeout: 60000 });
    // }

    console.log("✅ Login berhasil!");
    await page.waitForSelector('[data-id="K7dXd2v8o34gxlFV"]', { timeout: 30000 });
    await page.click('[data-id="K7dXd2v8o34gxlFV"]');

    let startButton;
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      startButton = await page.$("#start.btn.btn-huge.btn-success");
      if (startButton) break;
    }

    if (!startButton) {
      await interaction.editReply("❌ Tombol start tidak ditemukan!");
      return;
    }

    console.log("🚀 Menyalakan server...");
    await startButton.click();
    await interaction.editReply("🚀 Server sedang dalam proses start! Tunggu beberapa saat...");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const ads = await page.$("span.alert-close");
    if (ads) await ads.click();

    let status = "Loading";
    let lastMessageTime = Date.now();
    
    while (!status.toLowerCase().includes("online")) {
      await new Promise((resolve) => setTimeout(resolve, 15000));

      const statusElement = await page.$(".statuslabel");
      if (!statusElement) {
        console.log("❌ Gagal mendapatkan status server.");
        await interaction.editReply("❌ Gagal mendapatkan status server.");
        return;
      }

      status = await page.evaluate((el) => el.textContent.trim(), statusElement);
      console.log(`📡 Status terbaru: ${status}`);

      if (status.toLowerCase().includes("queue")) {
        const match = status.match(/(\d+\s*min)/);

        await interaction.editReply(`🤦‍♂️ Server sedang menunggu antrian ${match[1]} aktivasi...`);
        await new Promise((resolve) => setTimeout(resolve, 55000));
      } else if (Date.now() - lastMessageTime > 60000) {
        await interaction.editReply(`⏳ Server masih loading... Status: **${status}**`);
        lastMessageTime = Date.now();
      }
    }

    await interaction.editReply("✅ Server **sudah nyala**! 🎮 Ayo main!");

  } catch (error) {
    console.error("🚨 Terjadi error saat memulai server:", error);
    
    await interaction.editReply("❌ Terjadi kesalahan saat memulai server.");
  } finally {
    if (browser) {
      console.log("🔴 Menutup browser...");
      await browser.close();
      browser = null;
      page = null;
    }
  }
}
// ✅ Fungsi untuk cek status server Aternos
async function checkAternosStatus() {
  try {
    if (!browser || !page) {
      console.log("🌐 Meluncurkan ulang browser...");
       browser = await puppeteer.launch({
        headless: false,
        executablePath: PUPPERTER_BRWSER,
        userDataDir: "./user_data",
        args: ["--no-sandbox", "--disable-setuid-sandbox","--disable-blink-features=AutomationControlled","--disable-features=site-per-process",
        "--disable-web-security"],
      });
      
      page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36");
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
    }
    
    // Cek apakah halaman masih aktif
    const pages = await browser.pages();
    if (!pages.includes(page)) {
      console.log("⚠️ Frame terdeteksi terlepas, membuka halaman baru...");
      page = await browser.newPage();
    }
    
    console.log("🌐 Membuka halaman Aternos...");
    await page.goto(ATERNOST_URL, { waitUntil: "networkidle2", timeout: 0 });
    
    console.log("✅ Halaman terbuka!");
    if (!(await page.$(".server-body"))) {
      console.log("🔑 Login ke Aternos...");
      await page.type('input.username', ATERNOS_USER);
      await page.type('input.password', ATERNOS_PASS);
      await page.click('button.login-button.btn.btn-main.join-left');
      await page.waitForSelector(".server-body", { timeout: 60000 });
    }
    
    console.log("✅ Login berhasil!");
    await page.click('[data-id="K7dXd2v8o34gxlFV"]');

    let status = "❌ Tidak dapat mengambil status.";
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusElement = await page.$(".statuslabel");
    if (statusElement) {
      status = (await page.evaluate(el => el.textContent, statusElement)).trim();
      console.log(`📡 Status server: ${status}`);
    }

    // Tunggu sebentar sebelum menutup browser
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("🔴 Menutup browser...");
    await browser.close();
    browser = null;
    page = null;

    const info = status.toLowerCase().includes("online") ? "✅ Server telah online" : "❌ Server offline";
    return info;
  } catch (error) {
    console.error("🚨 Error saat mengecek status server:", error);

    if (browser) {
      console.log("🔴 Menutup browser karena error...");
      await browser.close();
      browser = null;
      page = null;
    }

    return "❌ Terjadi kesalahan saat mengecek status server.";
  }
}

bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  try {
    if (interaction.commandName === "start-minecraft") {
      await interaction.deferReply({ ephemeral: true }); // ✅ Hindari expired interaction
      await startAternosServer(interaction);
    } 
    else if (interaction.commandName === "status-minecraft") {
      await interaction.deferReply(); // ✅ Pastikan response tidak expired

      try {
        const status = await checkAternosStatus();
        await interaction.editReply(`📡 Status server: **${status}**`);
      } catch (error) {
        console.error("❌ Error saat mengecek status server:", error);
        await interaction.editReply("❌ Gagal mendapatkan status server.");
      }
    } 
    else if (interaction.commandName === "info-server-minecraft") {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🌍 Minecraft Server Info")
        .setDescription("Bergabunglah dengan dunia Minecraft kami! 🏰⛏️")
        .addFields(
          { name: "📌 Address", value: `\`${SERVER_MINECRAFT_ADDRES}\``, inline: true },
          { name: "📌 Port", value: `\`${SERVER_MINECRAFT_PORT}\``, inline: true },
          { name: "🔗 Url Server", value: `\`${SERVER_MINECRAFT_URL}\``, inline: true }
        )
        .setImage(SERVER_MINECRAFT_IMAGE_INFO)
        .setFooter({ text: "Ayo main bareng! 🚀", iconURL: "https://i.imgur.com/MZUV4Bl.jpeg" });

      // ✅ Pastikan interaction belum dibalas sebelumnya
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error("🚨 Error handling interaction:", error);

    // ✅ Pastikan interaction hanya dibalas sekali
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply("❌ Terjadi kesalahan.").catch(console.error);
    }
  }
});




bot.login(TOKEN);


// ✅ Tambahkan server untuk health check di Koyeb
const PORT = process.env.PORT || 8000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(PORT, () => {
  console.log(`🌍 Health check server running on port ${PORT}`);
});
