import React from "react";
import { useRef } from "react";

export const StatusCheckbox: React.FC<{ selectMode: boolean;currentNum: number; totalNum: number; onChange: () => void }> = props => {
  const { currentNum, totalNum, onChange, selectMode } = props;
  const checkboxRef = useRef(null);
  console.log("mode:",currentNum, totalNum, selectMode );
  React.useEffect(() => {
      if (!checkboxRef.current) return;
      const checkboxRefDOM = (checkboxRef.current as HTMLInputElement)
      if(currentNum === totalNum){
          if(selectMode === true){
              checkboxRefDOM.indeterminate = false;
              checkboxRefDOM.checked = false;
          }else{
              checkboxRefDOM.indeterminate = false;
              checkboxRefDOM.checked = true;
          }
      }else if (currentNum === 0) {
          if(selectMode === true){
              checkboxRefDOM.indeterminate = false;
              checkboxRefDOM.checked = true;
          }else{
              checkboxRefDOM.indeterminate = false;
              checkboxRefDOM.checked = false;
          }
      }else{
          checkboxRefDOM.indeterminate = true;
          checkboxRefDOM.checked = false;
      }
  }, [currentNum, totalNum, selectMode])

  return (
      <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
          ref={checkboxRef}
          onChange={() => onChange()}
      />
  )
}