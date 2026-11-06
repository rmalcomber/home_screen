// Keyboard handling for launcher panels. In the launcher modal a panel owns the keyboard. Inside a dashboard widget
// there can be several panels on the page, so their shortcuts only apply to keys typed inside that widget, and plain
// Enter is left alone (it is for typing in the widget's text box: use Ctrl+Enter or the buttons).
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

/** null in the launcher (global shortcuts); in a widget, a ref to the widget's root element. */
export const HotkeyScope = createContext(null)

/** const onKeydown = useHotkeyScope(); useEffect(() => onKeydown((e) => …)) — returns the unsubscribe function. */
export function useHotkeyScope() {
  const scope = useContext(HotkeyScope)
  return (handler) => {
    const h = (e) => {
      if (scope) {
        if (!scope.current || !scope.current.contains(e.target)) return
        if (e.key === 'Enter' && !(e.ctrlKey || e.metaKey)) return
      }
      handler(e)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }
}
