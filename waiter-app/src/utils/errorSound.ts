import { Vibration } from 'react-native';

export async function playErrorSound(): Promise<void> {
  Vibration.vibrate(120);
}
