/** キャラのステータス（STR/INT）を表示するTooltipコンテンツ */
export function CharacterStatTooltip({ name, str, int }: {
  name: string
  str: number
  int: number
}) {
  return (
    <div>
      <div className="text-white font-bold text-xs mb-1">{name}</div>
      <div className="flex gap-2 text-[10px]">
        <span className="text-gray-400 w-7">STR</span>
        <span className="text-gray-200 text-right w-4">{str}</span>
      </div>
      <div className="flex gap-2 text-[10px]">
        <span className="text-gray-400 w-7">INT</span>
        <span className="text-gray-200 text-right w-4">{int}</span>
      </div>
    </div>
  )
}
