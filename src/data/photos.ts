// La galería se arma sola con lo que haya en src/assets/fotos/.
// Para agregar más fotos: copia los archivos (JPG, PNG o WEBP) a esa carpeta y vuelve a publicar.
// Los mensajes cortos se pueden personalizar en src/assets/fotos/captions.json
// ({ "foto-01.jpg": "Tu mensaje" }). Si no hay mensaje, se usa uno genérico y afectuoso.
import captions from '../assets/fotos/captions.json'

const files = import.meta.glob('../assets/fotos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const GENERIC = [
  'Una sonrisa que ilumina.',
  'Con la luz que te hace única.',
  'Tal como eres, ya eres bonita.',
  'Que nunca te falten motivos para sonreír.',
  'Para que recuerdes lo especial que eres.',
]

export interface Photo {
  src: string
  name: string
  caption: string
}

export const PHOTOS: Photo[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src], i) => {
    const name = path.split('/').pop() ?? `foto-${i + 1}`
    const custom = (captions as Record<string, string>)[name]
    return { src, name, caption: custom && custom.trim() ? custom : GENERIC[i % GENERIC.length] }
  })
