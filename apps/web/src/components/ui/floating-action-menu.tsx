"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type FloatingActionMenuProps = {
options: {
  label: string;
  onClick: () => void;
  Icon?: React.ReactNode;
}[];
className?: string;
};

const FloatingActionMenu = ({
options,
className,
}: FloatingActionMenuProps) => {
const [isOpen, setIsOpen] = useState(false);

const toggleMenu = () => {
  setIsOpen(!isOpen);
};

return (
  <div className={cn("fixed bottom-8 right-8", className)}>
    <Button
      onClick={toggleMenu}
      className="w-12 h-12 rounded-full bg-[#1b77be] hover:bg-[#0f659f] shadow-[0_8px_24px_rgba(27,119,190,0.35)] border-0"
    >
      <motion.div
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
      >
        <Plus size={22} weight="bold" />
      </motion.div>
    </Button>

    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 10, y: 10, filter: "blur(10px)" }}
          animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 10, y: 10, filter: "blur(10px)" }}
          transition={{
            duration: 0.6,
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.1,
          }}
          className="absolute bottom-10 right-0 mb-2"
        >
          <div className="flex flex-col items-end gap-2">
            {options.map((option, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                }}
              >
                <Button
                  onClick={option.onClick}
                  size="sm"
                  className="flex items-center gap-2 bg-[#081b33]/90 hover:bg-[#081b33] text-white shadow-[0_4px_16px_rgba(8,27,51,0.25)] border-none rounded-xl backdrop-blur-sm"
                >
                  {option.Icon}
                  <span>{option.label}</span>
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};

export default FloatingActionMenu;
