import { Context, Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();
// Define your own context type
interface MyContext extends Context {
  myProp?: string
  myOtherProp?: number
}
console.log(process.env.BOT_TOKEN as string);
// Create your bot and tell it about your context type
const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN as string);
bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));