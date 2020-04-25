const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const client = new Discord.Client();
const queues = new Map();

const { prefix, token } = require('./config.json'); //Sửa trong file config.json

class Queue {
	constructor(voiceChannel) {
        this.voiceChannel = voiceChannel;
        this.connection = null;
        this.songs = [];
        this.volume = 100;
        this.playing = true;
        this.repeat = false;
    }
}

class Song {
    constructor(title, url) {
        this.title = title;
		this.url = url;
    }
}

client.once('ready', () =>{
	console.log('Ready');
});

client.login(token)

client.on('message', async msg => {
	if (msg.author.bot) return;

	if (msg.content.startsWith(prefix)) {
		const args = msg.content.slice(prefix.length).split(/ +/);
		const command = args[0];
		if (command === 'play') {
			let voiceChannel = msg.member.voice.channel;
			if (!voiceChannel) return msg.reply("Vào kênh âm nhạc trước đã!");
			let permissions = msg.member.voice.channel.permissionsFor(client.user);
			if (!permissions.has('CONNECT')||!permissions.has('SPEAK')) return msg.reply("Thiếu quyền vào kênh âm nhạc hoặc phát nhạc!");
			let url = args.slice(1).join(' ');
			let video = await ytdl.getInfo(url);
			if (!video) return msg.reply("Url không hợp lệ!");
			const song = new Song(video.title, video.video_url);
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) {
				let queue = new Queue(voiceChannel);
				queues.set(msg.guild.id, queue);
				queue.songs.push(song);
				let connection = await voiceChannel.join();
				queue.connection = connection;
				playSong(msg);
			} else {
				serverQueue.songs.push(song);
				msg.channel.send(`:notes: Thêm vào hàng chờ: ${song.title}`);
			}
			return
		}
		if (command === 'stop') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.songs = [];
			serverQueue.connection.dispatcher.end();
			return
		}
		if (command === 'skip') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.connection.dispatcher.end();
			msg.channel.send(`:notes: Bỏ qua bài: ${serverQueue.songs[0].title}`);
			return
		}
		if (command === 'pause') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.connection.dispatcher.pause();
			return
		}
		if (command === 'resume') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.connection.dispatcher.resume();
			return
		}
		if (command === 'repeat') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.repeat = true;
			msg.channel.send(`:notes: Lặp lại bài: ${serverQueue.songs[0].title}`);
			return
		}
		if (command === 'offrepeat') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			serverQueue.repeat = false;
			msg.channel.send(`:notes: Ngừng lặp lại bài: ${serverQueue.songs[0].title}`);
			return
		}
		if (command === 'volume') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			let volume = parseInt(args.slice(1).join(""));
			if (!isNaN(volume)) return msg.reply("Âm lượng không hợp lệ!");
			serverQueue.volume = volume;
			serverQueue.connection.dispatcher.setVolume(volume/100);
			return
		}
		if (command === 'queue') {
			const serverQueue = queues.get(msg.guild.id);
			if (!serverQueue) return msg.reply("Có bài nào đâu!");
			let result = serverQueue.songs.map((song, i) => {
				return `${(i == 0) ? `\`Đang phát:\`` : `${i}.`} ${song.title}`
			}).join('\n');
			msg.channel.send(result);
			return
		}
	}
})

async function playSong(msg) {
	const serverQueue = queues.get(msg.guild.id);
	if (!serverQueue) return;
	if (serverQueue.songs.length < 1) {
		serverQueue.voiceChannel.leave();
    	queues.delete(msg.guild.id);
    	return msg.channel.send("Hết nhạc!");
	}
	let song = serverQueue.songs[0];
	let dispatcher = serverQueue.connection.play(ytdl(song.url, {filter: 'audioonly', highWaterMark: 1<<25, type: 'opus'}));
	dispatcher.setVolume(serverQueue.volume/100);
	msg.channel.send(`:notes: Bắt đầu phát: ${song.title}`);
	dispatcher.on('finish', () => {
		if (!serverQueue.repeat) serverQueue.songs.shift();
		return playSong(msg);
	});
}