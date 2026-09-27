import * as ImagePicker from 'expo-image-picker';

export async function pickImage(source: 'camera' | 'library'): Promise<{ uri: string; width: number; height: number } | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Hace falta permiso de cámara.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.92 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Hace falta permiso para la galería.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
}
