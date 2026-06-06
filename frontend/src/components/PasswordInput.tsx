import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  toggleButtonClassName?: string;
  visibilityIconClassName?: string;
  showPasswordAriaLabel?: string;
  hidePasswordAriaLabel?: string;
}

function mergeClassNames(
  ...classNames: Array<string | false | null | undefined>
) {
  return classNames.filter(Boolean).join(" ");
}

const DEFAULT_TOGGLE_BUTTON_CLASS =
  "absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-(--color-text-secondary) transition hover:text-(--color-text-main) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/30";

const DEFAULT_VISIBILITY_ICON_CLASS = "h-4 w-4";

export default function PasswordInput({
  toggleButtonClassName,
  visibilityIconClassName,
  showPasswordAriaLabel = "Mostrar contraseña",
  hidePasswordAriaLabel = "Ocultar contraseña",
  className,
  ...inputProps
}: PasswordInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <>
      <input
        {...inputProps}
        type={isPasswordVisible ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        onClick={() =>
          setIsPasswordVisible((previousVisibility) => !previousVisibility)
        }
        aria-label={
          isPasswordVisible ? hidePasswordAriaLabel : showPasswordAriaLabel
        }
        className={mergeClassNames(
          DEFAULT_TOGGLE_BUTTON_CLASS,
          toggleButtonClassName
        )}
      >
        {isPasswordVisible ? (
          <EyeOff
            aria-hidden="true"
            className={visibilityIconClassName ?? DEFAULT_VISIBILITY_ICON_CLASS}
          />
        ) : (
          <Eye
            aria-hidden="true"
            className={visibilityIconClassName ?? DEFAULT_VISIBILITY_ICON_CLASS}
          />
        )}
      </button>
    </>
  );
}
