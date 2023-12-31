const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');

const models = process.env.MODELS
const modelList = models.split(",");

const choices = modelList.map(a => ({name: a, value: a}));

const defaultTimeout = parseInt(process.env.TIMEOUT);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask jamo anything!!')
        .addStringOption(op => op.setName("question").setDescription("What do you want to ask?").setRequired(true))
        .addStringOption(op => op.setName("model").setDescription("Which version is smarter?").addChoices(...choices ).setRequired(false))
        .addIntegerOption(op => op.setName("timeout").setDescription("How much would you wait for a response?").setRequired(false).setMinValue(5)),
    async execute( /** @type {ChatInputCommandInteraction}*/ interaction) {
		const question = interaction.options.getString('question') ?? 'No Question!';
        const model = interaction.options.getString("model") ?? modelList[0];
        let requestedTimeout = interaction.options.getInteger("timeout") * 1000;
        if (requestedTimeout < defaultTimeout) {
            requestedTimeout = defaultTimeout;
        }
        
        if (!modelList.includes(model)) {
            await interaction.reply(`${model} 은 적절한 모델이 아닙니다. 적잘한 모델은 다음과 같습니다: ${modelList.map(a => `\`${a}\``).join(", ")}`)
            return;
        }

        await interaction.deferReply();


        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), requestedTimeout);
        try {
            const body = await fetch(`${process.env.SUZUME}/generate`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "User-ID": `Discord-${interaction.user.id}`
                },
                body: JSON.stringify({
                    req: question,
                    context: [],
                    stream: false,
                    max_token: 256,
                    model: model
                }),
                signal: controller.signal
            });
            clearTimeout(id);
            const json = await body.json();
            if (json.error)  {
                await interaction.editReply(`스즈메 백엔드에서 오류가 발생하였습니다: \nID: \`${json.req_id}\`\n에러: \`${json.error}\``)
            } else {
                await interaction.editReply(`ID: \`${json.req_id}\`\n모델: \`${json.model}\`\n응답: ${json.resp}`)
            }
        } catch (e) {
            clearTimeout(id);
            console.error(e);
            await interaction.editReply("스즈메 백앤드 요청 중 오류가 발생하였습니다.");
        }
    }
}