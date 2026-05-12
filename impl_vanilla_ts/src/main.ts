import { Logic } from './logic';
import { UI } from './ui';

const host = document.getElementById('app')!;

const ui = new UI(host);
const logic = new Logic(ui);
ui.onPaletteColorClicked = (color) => logic.onPaletteColorClicked(color);

logic.start();
ui.start();
