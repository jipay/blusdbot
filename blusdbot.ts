import { Context, Telegraf, Telegram } from 'telegraf';
import { BigNumberish, ethers, FixedNumber } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const MIN_SWAP_SIZE = 20000;
const TEST_HISTORY_BLOCK_NUMBERS = -100000;
const CURVE_ROUTER_ADDRESS = "0xD1602F68CC7C4c7B59D686243EA35a9C73B0c6a2";
const BLUSD_ADDRESS = "0xB9D7DdDca9a4AC480991865EfEf82E01273F79C3";
const LUSD_ADDRESS = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";

const abiCurveBlusd = `[
	{
		"name": "TokenExchange", "inputs":
			[
				{ "name": "buyer", "type": "address", "indexed": true },
				{ "name": "sold_id", "type": "uint256", "indexed": false },
				{ "name": "tokens_sold", "type": "uint256", "indexed": false },
				{ "name": "bought_id", "type": "uint256", "indexed": false },
				{ "name": "tokens_bought", "type": "uint256", "indexed": false }
			]
		, "anonymous": false, "type": "event"
	},
	{
		"stateMutability":"view","type":"function","name":"get_dy","inputs":
		[
			{"name":"i","type":"uint256"},
			{"name":"j","type":"uint256"},
			{"name":"dx","type":"uint256"}
		]
		,"outputs":
		[
			{"name":"","type":"uint256"}
		]
	}
]`;

const abiCurveLusd = `[
	{
		"name":"calc_withdraw_one_coin",
		"outputs":
		[
			{"type":"uint256","name":""}
		],
		"inputs":
		[
			{"type":"uint256","name":"_burn_amount"},
			{"type":"int128","name":"i"},
			{"type":"bool","name":"_previous"}
		]
		,"stateMutability":"view","type":"function"
	}
]`;

const abiTest = [
	"event TokenExchange (address indexed buyer, uint256 sold_id, uint256 tokens_sold, uint256 bought_id, uint256 tokens_bought)",
	"function get_dy (uint256 i, uint256 j, uint256 dx) view returns (uint256)"
]

// const abiCurveRouter = [
// 	{
// 		"name":"get_best_rate",
// 		"outputs":
// 		[
// 			{"type":"address","name":""},
// 			{"type":"uint256","name":""}
// 		],
// 		"inputs":
// 		[
// 			{"type":"address","name":"_from"},
// 			{"type":"address","name":"_to"},
// 			{"type":"uint256","name":"_amount"}
// 		],
// 		"stateMutability":"view","type":"function","gas":298910689
// 	}
// ];

const abiCurveRouter = `[{"name":"get_best_rate",
"outputs":[{"type":"address","name":""},{"type":"uint256","name":""}],
"inputs":[{"type":"address","name":"_from"},{"type":"address","name":"_to"},{"type":"uint256","name":"_amount"}],
"stateMutability":"view","type":"function","gas":298910689}]`;

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

const provider = new ethers.InfuraProvider("mainnet", process.env.INFURA_KEY);
const contract = new ethers.Contract(
	"0x74ed5d42203806c8cdcf2f04ca5f60dc777b901c",
	abiCurveBlusd,
	provider
);

const contract2 = new ethers.Contract(
	"0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
	abiCurveLusd,
	provider
);

async function main() {
	const filterSwap = contract.filters.TokenExchange(null, null, null, null, null);
	const eventSwap = await contract.queryFilter(filterSwap, TEST_HISTORY_BLOCK_NUMBERS);
	// contract.on("Swap", (src, dst, srcAmount, dstAmount, blockNumber, transactionIndex, logIndex) => {
	// 	console.log("y'a d uswap");
	// });
	contract.on("*", (event) => {
		console.log("Il se passe des trucs sur la blockchain");
	});

	contract.on('TokenExchange', (buyer, sold_id, tokens_sold, bought_id, tokens_bought, event) => {
		onSwap(event);
	});
	
	eventSwap.forEach((e) => (onSwap(e)));
}

main();

async function onSwap(e: any) {
	const blockNumber = e.blockNumber;
	const transactionIndex = e.transactionIndex;
	const args = e.args;
	let soldToken = args.sold_id.toString() == '1' ? 'LUSD3CRV' : 'bLUSD';
	let buyToken = args.bought_id.toString() == '1' ? 'LUSD3CRV' : 'bLUSD';
	let numberIn: number = FixedNumber.fromString(ethers.formatEther(args.tokens_sold)).toUnsafeFloat();
	let numberOut: number = FixedNumber.fromString(ethers.formatEther(args.tokens_bought)).toUnsafeFloat();
	const stEthToEthFactor: number =  await getCurvePrice("0x74ED5d42203806c8CDCf2F04Ca5F60DC777b901c", 1000000000000000000n, 0n, 1n);
	//const stEthToEthFactor: number = 1;
	//const msg = `🚀 Swap ${numberIn} <a href="http://etherscan.io">${soldToken}</a> for ${ethers.formatEther(args.tokens_bought)} <a href="http://etherscan.io">${buyToken}</a> - bLUSD price ${stEthToEthFactor} - <a href="https://etherscan.io/tx/${e.transactionHash}">txHash</a>\n<i>block ${blockNumber}</i> | #${transactionIndex}`
	const msg = `🚀 Swap ${numberIn.toFixed(2)} ${soldToken} for ${numberOut.toFixed(2)} ${buyToken} - bLUSD/LUSD price ${stEthToEthFactor.toFixed(5)} - <a href="https://etherscan.io/tx/${e.transactionHash}">txHash</a>\n<i>block ${blockNumber}</i> | #${transactionIndex}`

	if (numberIn >= MIN_SWAP_SIZE)
		bot.telegram.sendMessage(process.env.CHATID as string, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
	else
		console.log(msg);
}

async function getCurvePrice(_poolAddress: string, _amount: BigNumberish,
	_i: BigNumberish, _j: BigNumberish): Promise<number> {
		const price = await contract.get_dy(_i, _j, _amount);
		const price2 = await contract2.calc_withdraw_one_coin(1000000000000000000n, 0, false);
		return FixedNumber.fromString(ethers.formatUnits(price, 18)).toUnsafeFloat() *
		FixedNumber.fromString(ethers.formatUnits(price2, 18)).toUnsafeFloat();
}