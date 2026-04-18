import js from '@eslint/js'
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules'

export default [
  js.configs.recommended,
  firebaseRulesPlugin.configs['flat/recommended']
]
