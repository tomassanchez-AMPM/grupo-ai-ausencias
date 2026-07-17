// Logo de Pausa según el manual de marca: símbolo de pausa sobre un sol
// de arena poniéndose en el agua (menta). Dibujado en SVG para nitidez
// en cualquier tamaño sin depender de imágenes externas.

export function LogoPausa({ tamano = 38 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" role="img" aria-label="Logo de Pausa">
      <circle cx="32" cy="27" r="17" fill="#EADBC1" />
      <rect x="24" y="15" width="6" height="19" rx="3" fill="#0F3D3A" />
      <rect x="34" y="15" width="6" height="19" rx="3" fill="#0F3D3A" />
      <rect x="13" y="40" width="38" height="4.5" rx="2.25" fill="#A7DCCB" />
      <rect x="19" y="47.5" width="26" height="4.5" rx="2.25" fill="#A7DCCB" />
      <rect x="25" y="55" width="14" height="4.5" rx="2.25" fill="#A7DCCB" />
    </svg>
  )
}
