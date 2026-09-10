import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8082);

createApp().listen(port, () => {
	console.log(`hotel-ms-usuarios escuchando en el puerto ${port}`);
});