const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const noblox = require('noblox.js');
const configFilePath = './config.json';

// Cargar la configuración y las verificaciones desde el archivo JSON
let config = require(configFilePath);

// Guardar la configuración y las verificaciones en el archivo JSON
const saveConfig = () => {
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
};

// Iniciar sesión en Roblox
noblox.setCookie(config.robloxCookie).then(user => {
  console.log(`Iniciado sesión en Roblox como ${user.UserName}`);
}).catch(err => {
  console.error('Error al iniciar sesión en Roblox:', err);
});

// Crear una nueva instancia del cliente de Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
  console.log(`Bot de Discord conectado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return; // Ignorar mensajes del bot

  // Comando de prueba para crear el rol
  if (message.content.startsWith('!testrol')) {
    try {
      let role = message.guild.roles.cache.find(r => r.name === 'Verificado');
      if (!role) {
        role = await message.guild.roles.create({
          name: 'Verificado',
          color: '#0000FF', // Color azul en formato hexadecimal
          reason: 'Rol creado para verificar usuarios de Roblox'
        });
        console.log('Rol "Verificado" creado.');
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('Rol Creado')
          .setDescription('El rol "Verificado" ha sido creado con éxito.');
        message.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle('Rol Existente')
          .setDescription('El rol "Verificado" ya existe.');
        message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error al crear el rol "Verificado":', error);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription('Hubo un error al crear el rol "Verificado". Por favor, inténtalo nuevamente.');
      message.reply({ embeds: [embed] });
    }
  }

  // Comando para verificar usuarios de Roblox
  if (message.content.startsWith('!verificar')) {
    const args = message.content.split(' ');
    const robloxUsername = args[1];

    if (!robloxUsername) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription('Por favor, proporciona tu nombre de usuario de Roblox. Ejemplo: `!verificar TuNombreDeUsuario`');
      return message.reply({ embeds: [embed] });
    }

    try {
      const robloxUserId = await noblox.getIdFromUsername(robloxUsername);
      const isInGroup = await noblox.getRankInGroup(config.groupId, robloxUserId) > 0;

      // Crear o actualizar la verificación
      const existingVerification = config.verifications.find(v => v.discordId === message.author.id);

      if (existingVerification) {
        const embed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle('Ya Verificado')
          .setDescription(`Ya estás verificado como ${existingVerification.robloxUsername}.`);
        return message.reply({ embeds: [embed] });
      }

      const newVerification = {
        discordId: message.author.id,
        robloxId: robloxUserId,
        robloxUsername: robloxUsername,
        verifiedAt: new Date(),
        inGroup: isInGroup
      };

      config.verifications.push(newVerification);
      saveConfig();

      // Crear el rol "Verificado" si no existe
      let role = message.guild.roles.cache.find(r => r.name === 'Verificado');
      if (!role) {
        try {
          role = await message.guild.roles.create({
            name: 'Verificado',
            color: '#0000FF', // Color azul en formato hexadecimal
            reason: 'Rol creado para verificar usuarios de Roblox'
          });
          console.log('Rol "Verificado" creado.');
        } catch (error) {
          console.error('Error al crear el rol "Verificado":', error);
          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Hubo un error al crear el rol "Verificado". Por favor, inténtalo nuevamente.');
          return message.reply({ embeds: [embed] });
        }
      }

      // Asignar el rol al usuario
      const member = message.guild.members.cache.get(message.author.id);
      if (member && role) {
        try {
          await member.roles.add(role);
          console.log(`Rol "Verificado" asignado a ${message.author.tag}`);

          // Obtener la URL del avatar de Roblox
          const robloxUserInfo = await noblox.getPlayerInfo(robloxUserId);
          const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUserId}&width=420&height=420&format=png`;

          // Enviar un embed al canal de verificación
          const verificationChannel = message.guild.channels.cache.get(config.verificationChannelId);
          if (verificationChannel) {
            const embed = new EmbedBuilder()
              .setColor('#00FF00') // Color verde en formato decimal
              .setTitle('Usuario Verificado')
              .setDescription(`${message.author.username} (@${robloxUsername}) ha sido verificado.`)
              .addFields(
                { name: 'Usuario de Discord', value: message.author.tag, inline: true },
                { name: 'Usuario de Roblox', value: robloxUsername, inline: true },
                { name: 'Fecha de Verificación', value: new Date().toLocaleString(), inline: false }
              )
              .setThumbnail(avatarUrl) // Imagen en miniatura del avatar de Roblox
              .setURL(`https://www.roblox.com/users/${robloxUserId}/profile`) // Enlace al perfil de Roblox
              .setTimestamp();
            verificationChannel.send({ embeds: [embed] });
          }

          const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Verificación Completa')
            .setDescription(`¡Verificación completada! ${robloxUsername} ha sido verificado y el rol "Verificado" ha sido asignado.`);
          message.reply({ embeds: [successEmbed] });
        } catch (error) {
          console.error('Error al asignar el rol "Verificado":', error);
          if (error.code === 50013) {
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Permisos Insuficientes')
              .setDescription('No tengo permisos suficientes para asignar el rol "Verificado". Asegúrate de que el rol del bot esté por encima del rol "Verificado" y que el bot tenga los permisos adecuados.');
            return message.reply({ embeds: [embed] });
          } else {
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Error')
              .setDescription('Hubo un error al asignar el rol "Verificado". Asegúrate de que el bot tenga los permisos necesarios.');
            return message.reply({ embeds: [embed] });
          }
        }
      } else {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Error')
          .setDescription('No se pudo encontrar el miembro o el rol en el servidor.');
        message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Error al verificar el usuario de Roblox:', err);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription('Hubo un error al verificar tu cuenta. Por favor, inténtalo nuevamente.');
      message.reply({ embeds: [embed] });
    }
  } else if (message.content.startsWith('!mi-verificacion')) {
    const verification = config.verifications.find(v => v.discordId === message.author.id);
    if (verification) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Verificación')
        .setDescription(`Estás verificado como ${verification.robloxUsername}. ${verification.inGroup ? 'Estás en el grupo de Roblox.' : 'No estás en el grupo de Roblox.'}`)
        .addFields(
          { name: 'Fecha de Verificación', value: verification.verifiedAt.toLocaleString(), inline: false }
        );
      message.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('No Verificado')
        .setDescription('No estás verificado.');
      message.reply({ embeds: [embed] });
    }
  } else if (message.content.startsWith('!eliminar-verificacion')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Permisos Insuficientes')
        .setDescription('No tienes permiso para usar este comando.');
      return message.reply({ embeds: [embed] });
    }

    const args = message.content.split(' ');
    const discordId = args[1];
    if (!discordId) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription('Por favor, proporciona el ID de Discord del usuario cuya verificación deseas eliminar.');
      return message.reply({ embeds: [embed] });
    }

    const index = config.verifications.findIndex(v => v.discordId === discordId);
    if (index !== -1) {
      const verification = config.verifications[index];
      config.verifications.splice(index, 1);
      saveConfig();

      // Eliminar el rol del usuario
      const member = message.guild.members.cache.get(discordId);
      const role = message.guild.roles.cache.find(r => r.name === 'Verificado');
      if (member && role) {
        try {
          await member.roles.remove(role);
          console.log(`Rol "Verificado" removido de ${member.user.tag}`);
          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Verificación Eliminada')
            .setDescription('La verificación ha sido eliminada y el rol "Verificado" ha sido removido.');
          message.reply({ embeds: [embed] });
        } catch (error) {
          console.error('Error al remover el rol "Verificado":', error);
          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Hubo un error al remover el rol "Verificado". Asegúrate de que el bot tenga los permisos necesarios.');
          message.reply({ embeds: [embed] });
        }
      } else {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Error')
          .setDescription('No se encontró al miembro o el rol en el servidor.');
        message.reply({ embeds: [embed] });
      }
    } else {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('No Encontrado')
        .setDescription('No se encontró ninguna verificación para el ID de Discord proporcionado.');
      message.reply({ embeds: [embed] });
    }
  }
});

client.login(config.discordToken);
